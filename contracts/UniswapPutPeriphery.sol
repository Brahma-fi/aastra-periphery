// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.5;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./interfaces/IPeriphery.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IERC20Metadata.sol";
import "./libraries/LongMath.sol";

/// @title Periphery
contract Periphery is IPeriphery {
    using SafeMath for uint256;
    using LongMath for uint256;
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IVault;

    ISwapRouter public immutable swapRouter = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    IQuoter public immutable quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);
    
    IFactory public factory;

    constructor(IFactory _factory) {
        factory = _factory;
    } 

    /// @inheritdoc IPeriphery
    function vaultDeposit(uint256 amount0In, uint256 amount1In, uint256 slippage, address strategy) 
    external override minimumAmount(amountIn) {
        require(slippage <= 100*100, "100% slippage is not allowed");

        (IVault vault, IUniswapV3Pool pool, IERC20Metadata token0, IERC20Metadata token1) = _getVault(strategy);

        // Calculate amount to swap based on tokens in vault
        // token0 / token1 = k
        // token0 + token1 = amountIn
        uint256 factor = 10 **
            (uint256(18).sub(token1.decimals()).add(token0.decimals()));

        (uint256 amountToSwap, bool direction) = _calculateAmountToSwap(vault, pool, factor amount0In, amount1In);
        
        // transfer token0 from sender to contract & approve router to spend it
        token0.safeTransferFrom(msg.sender, address(this), amountIn);
        token0.approve(address(swapRouter), amountToSwap);

        // swap token0 for token1
        uint256 amountOutQuoted = quoter.quoteExactInputSingle(
            address(token0), 
            address(token1), 
            pool.fee(), 
            amountToSwap, 
            0
        );

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(token0),
                tokenOut: address(token1),
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountToSwap,
                amountOutMinimum: amountOutQuoted.mul(100*100 - slippage).div(100*100),
                sqrtPriceLimitX96: 0
            });
        uint256 amountOut = swapRouter.exactInputSingle(params);

        // deposit token0 & token1 in vault
        token0.approve(address(vault), _tokenBalance(token0));
        token1.approve(address(vault), amountOut);

        vault.deposit(_tokenBalance(token0), amountOut, 0, 0, msg.sender);

        // send balance of token1 & token0 to user
        _sendBalancesToUser(token0, token1, msg.sender);
    }

    /// @inheritdoc IPeriphery
    function vaultWithdraw(uint256 shares, address strategy) external override minimumAmount(shares) {
        (IVault vault, uint24 poolFee, IERC20Metadata token0, IERC20Metadata token1) = _getVault(strategy);

        // transfer shares from msg.sender & withdraw
        vault.safeTransferFrom(msg.sender, address(this), shares);
        (uint256 amount0, uint256 amount1) = vault.withdraw(shares, 0, 0, address(this));

        token1.approve(address(swapRouter), amount1);

        // swap token0 for token1
        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(token1),
                tokenOut: address(token0),
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amount1,
                amountOutMinimum: quoter.quoteExactInputSingle(
                    address(token1), 
                    address(token0), 
                    poolFee, 
                    amount1, 
                    0
                ),
                sqrtPriceLimitX96: 0
            });
        swapRouter.exactInputSingle(params);

        // send balance of token1 & token0 to user
        _sendBalancesToUser(token0, token1, msg.sender);
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
      * @param strategy strategy to get manager vault from
      * @return vault, poolFee, token0, token1
     */
    function _getVault(address strategy) internal view 
        returns (IVault, uint24, IERC20Metadata, IERC20Metadata) 
    {
        address vaultAddress = factory.managerVault(strategy);
        
        require(vaultAddress != address(0x0), "Not a valid strategy");

        IVault vault = IVault(vaultAddress);
        IUniswapV3Pool pool  = vault.pool();

        uint24 poolFee = vault.pool().fee();
        IERC20Metadata token0 = vault.token0();
        IERC20Metadata token1 = vault.token1();

        return (vault, poolFee, token0, token1);
    }

    /**
      * @notice Get the amount to swap befor deposit
      * @param vault vault to get token balances from
      * @param amountIn minimum amount in
      * @return amount to swap
     */
    function _calculateAmountToSwap(IVault vault, IUniswapV3Pool pool, uint256 factor, uint256 amount0In, uint256 amount1In) internal view returns (uint256 amountToSwap, bool isToken0Excess) {
        (uint256 token0InVault, uint256 token1InVault) = vault.getTotalAmounts();
        
        if(token0InVault == 0 || token1InVault == 0) {
            isToken0Excess = token0InVault==0;
            amountToSwap = isToken0Excess? amount0: amount1;
        }
        else {
        uint256 ratio = token1InVault.mulDiv(factor, token0InVault);
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        uint256 price = uint256(sqrtPriceX96).mul(uint256(sqrtPriceX96)).mul(
            factor
        ) >> (96 * 2);

        uint256 token0Converted = ratio.mulDiv(amount0, factor);
        isToken0Excess = amount1 < token0Converted;

        uint256 excessAmount = isToken0Excess ? token0Converted.sub(amount1).mulDiv(factor, ratio) : amount1.sub(token0Converted);
        amountToSwap = isToken0Excess
            ? excessAmount.mulDiv(ratio, price.add(ratio))
            : excessAmount.mulDiv(price, price.add(ratio));
        }
}

    /**
      * @notice send remaining balances of tokens to user
      * @param token0 token0 instance
      * @param token1 token1 instance
      * @param recipient address of recipient to receive balances
     */
    function _sendBalancesToUser(
        IERC20Metadata token0, 
        IERC20Metadata token1, 
        address recipient
    ) internal {
        if(_tokenBalance(token0) > 0) {
            token0.safeTransfer(recipient, _tokenBalance(token0));
        }
        if(_tokenBalance(token1) > 0) {
            token1.safeTransfer(recipient, _tokenBalance(token1));
        }
    }

    modifier minimumAmount(uint256 amountIn) {
        require(amountIn > 0, "amountIn not sufficient");
        _;
    }
}