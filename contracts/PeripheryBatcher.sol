// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interfaces/IERC20Metadata.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IPeriphery.sol";
import "./interfaces/IVault.sol";


contract PeripheryBacther {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IFactory public factory;
    IPeriphery public periphery;
    mapping(address => UserLedger[]) public userLedgers;
    mapping(address => uint) public strategyUserCount;
    mapping(address => uint) public totalAmountIn;
    mapping(address => uint) public lastDepositedIndex;
    mapping(address => address) public tokenAddress;

    struct UserLedger {
        uint amount;
        bool status;
        address user;
        address token;
    }

    constructor(IFactory _factory, IPeriphery _periphery) public {
        factory = _factory;
        periphery = _periphery;
    } 

    function depositFunds(uint amountIn, address vaultAddress, address token) public{
        (IVault vault, IUniswapV3Pool pool, IERC20Metadata token0, IERC20Metadata token1) = _getVault(vaultAddress);

        require(tokenAddress[vaultAddress] != address(0), 'Invalid tokenAddress');

        IERC20(token).safeTransferFrom(msg.sender, address(this), amountIn);

        UserLedger memory user = UserLedger({
            amount: amountIn,
            status: false,
            user: msg.sender,
            token: token    
        });

        userLedgers[vaultAddress][strategyUserCount[vaultAddress]] = user;
        strategyUserCount[vaultAddress]++;
        totalAmountIn[vaultAddress] += amountIn;
    }

    function batchDepositPeriphery(address vaultAddress, uint usersToDeposit) public {
        (IVault vault, IUniswapV3Pool pool, IERC20Metadata token0, IERC20Metadata token1) = _getVault(vaultAddress);

        IERC20 token = IERC20(tokenAddress[vaultAddress]);

        if (lastDepositedIndex[vaultAddress] == 0) {
            token.approve(address(periphery), type(uint256).MAX_VALUE);
        }

        UserLedgers[] memory userLedgers = userLedgers[vaultAddress];
        uint length = usersToDeposit + lastDepositedIndex[vaultAddress];
        if (length > userLedgers.length) {
            length = userLedgers.length;
        }
        uint amount;

        for (int i = lastDepositedIndex[vaultAddress]; i < length; i++) {
            UserLedger storage user = userLedgers[i];
            if (user.status == false) {
                amount+= user.amount;
                user.status = true;
            }
        }

        uint oldLPBalance = vault.balanceOf(address(this));
        
        periphery.vaultDeposit(amount, address(token), 500, factory.vaultManager(vaultAddress));

        uint lpTokensReceived = vault.balanceOf(address(this)) - oldLPBalance;

        for (int i = lastDepositedIndex[vaultAddress]; i < length; i++) {
            UserLedger storage user = userLedgers[i];
            uint tokensToSend = (user.amount * lpTokensReceived / amount);
            vault.transfer(user.user, tokensToSend);
        }

        lastDepositedIndex[vaultAddress] = length;
        totalAmountIn[vaultAddress] -= amount;
    }

    /// TODO implement onlyOwner from openzeppelin
    function setStrategyTokenAddress(address vaultAddress, address token) public {
        (IVault vault, IUniswapV3Pool pool, IERC20Metadata token0, IERC20Metadata token1) = _getVault(vaultAddress);
        require(address(token0) == token || address(token1) == token, 'wrong token address');
        tokenAddress[vaultAddress] = token;
    }

    /**
      * @notice Get the balance of a token in contract
      * @param token token whose balance needs to be returned
      * @return balance of a token in contract
     */
    function _tokenBalance(IERC20Metadata token) internal view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
      * @notice Get the vault details from strategy address
      * @param vaultAddress strategy to get manager vault from
      * @return vault, poolFee, token0, token1
     */
    function _getVault(address vaultAddress) internal view 
        returns (IVault, IUniswapV3Pool, IERC20Metadata, IERC20Metadata) 
    {
        
        require(vaultAddress != address(0x0), "Not a valid vault");

        IVault vault = IVault(vaultAddress);
        IUniswapV3Pool pool  = vault.pool();

        IERC20Metadata token0 = vault.token0();
        IERC20Metadata token1 = vault.token1();

        return (vault, pool, token0, token1);
    }

}
