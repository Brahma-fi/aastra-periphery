const { checkEqual, checkAbove, checkRevert, checkBelow } = require("./helper");

const POOL_ADDRESS = "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8";
const FACTORY_ADDRESS = "0xBAD59D2BA9A532242F1287DeaBc4227E8150D074";
const VAULT_ADDRESS = "0xc10d2E42dE16719523aAA9277d1b9290aA6c3Ad5";
const STABLE_COIN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const UNISWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

let periphery, batcher, accounts, USDC, LP;

const setupContracts = async () => {
  const Periphery = await hre.ethers.getContractFactory("Periphery");
  periphery = await Periphery.deploy(FACTORY_ADDRESS);

  await periphery.deployed();

  const Batcher = await hre.ethers.getContractFactory("PeripheryBatcher");
  batcher = await Batcher.deploy(FACTORY_ADDRESS, periphery.address);

  await batcher.deployed();

  USDC = await hre.ethers.getContractAt("IERC20", STABLE_COIN_ADDRESS);
  LP = await hre.ethers.getContractAt("IERC20", VAULT_ADDRESS);

  await batcher.setVaultTokenAddress(VAULT_ADDRESS, STABLE_COIN_ADDRESS);
};

const getUSDCinAccount = async () => {
  accounts = await hre.ethers.getSigners();
  const WETH = await hre.ethers.getContractAt("IWETH9", WETH_ADDRESS);

  await WETH.deposit({ value: 10000000000000n });
  await WETH.approve(UNISWAP_ROUTER_ADDRESS, 10000000000000000000000000n);

  ISwapRouter = await hre.ethers.getContractAt(
    "ISwapRouter",
    UNISWAP_ROUTER_ADDRESS
  );
  await ISwapRouter.exactInputSingle({
    tokenIn: WETH_ADDRESS,
    tokenOut: STABLE_COIN_ADDRESS,
    fee: 3000,
    recipient: accounts[0].address,
    deadline: 10000000000,
    amountIn: 10000000000000,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  });
};

describe("PeripheryBatcher tests", () => {
  before(async () => {
    await setupContracts();
    await getUSDCinAccount();
  });

  it("Should be setup correctly", async () => {
    checkEqual(await periphery.factory(), FACTORY_ADDRESS);

    checkEqual(await batcher.factory(), FACTORY_ADDRESS);
    checkEqual(await batcher.periphery(), periphery.address);
    checkEqual(await batcher.tokenAddress(VAULT_ADDRESS), STABLE_COIN_ADDRESS);
  });

  it("Should be able to take 2 deposits and resolve", async () => {
    await USDC.approve(
      batcher.address,
      await USDC.balanceOf(accounts[0].address)
    );

    const batcherBalance = await USDC.balanceOf(batcher.address);
    const USDCBalance = await USDC.balanceOf(accounts[0].address);
    const LPBalance = await LP.balanceOf(accounts[0].address);

    checkEqual(LPBalance, 0);
    checkEqual(batcherBalance, 0);

    await batcher.depositFunds(USDCBalance / 2, VAULT_ADDRESS);
    await batcher.depositFunds(USDCBalance / 2, VAULT_ADDRESS);

    checkAbove(await USDC.balanceOf(batcher.address), batcherBalance);

    await batcher.batchDepositPeriphery(VAULT_ADDRESS, [accounts[0].address]);

    checkAbove(await LP.balanceOf(accounts[0].address), LPBalance);
  });

  it("Should be able to deposit after one batch resolves", async () => {
    await getUSDCinAccount();
    await USDC.approve(
      batcher.address,
      await USDC.balanceOf(accounts[0].address)
    );

    const batcherBalance = await USDC.balanceOf(batcher.address);
    const USDCBalance = await USDC.balanceOf(accounts[0].address);
    const LPBalance = await LP.balanceOf(accounts[0].address);

    await batcher.depositFunds(USDCBalance / 2, VAULT_ADDRESS);

    checkAbove(await USDC.balanceOf(batcher.address), batcherBalance);

    await batcher.batchDepositPeriphery(VAULT_ADDRESS, [accounts[0].address]);

    checkAbove(await LP.balanceOf(accounts[0].address), LPBalance);

    const newUSDCBalance = await USDC.balanceOf(accounts[0].address);
    await batcher.depositFunds(USDCBalance / 2, VAULT_ADDRESS);

    checkBelow(await USDC.balanceOf(accounts[0].address), newUSDCBalance);
  });

  it("Should be able to deposit to different vaults", async () => {
    const factory = await hre.ethers.getContractAt(
      "IFactory",
      await periphery.factory()
    );
    const governance = await factory.governance();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [governance]
    });

    const signer = await hre.ethers.getSigner(governance);

    console.log(signer.address);
    tx = await factory
      .connect(signer)
      .createVault(POOL_ADDRESS, governance, 100000, 0, 0);
    await tx.wait();
    const vaultAddress = await factory.managerVault(governance);
    console.log("vault address", vaultAddress);
  });
});
