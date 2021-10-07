const hre = require("hardhat");

const etherscan_verify = false;

const FACTORY_ADDRESS = "0xBAD59D2BA9A532242F1287DeaBc4227E8150D074";

const VAULT_ADDRESS = "0xc10d2E42dE16719523aAA9277d1b9290aA6c3Ad5";
const STABLE_COIN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const UNISWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const accounts = await hre.ethers.getSigners();
  console.log(
    "current acc balance",
    (await hre.ethers.provider.getBalance(accounts[0].address)).toString()
  );

  const Periphery = await hre.ethers.getContractFactory("Periphery");
  const periphery = await Periphery.deploy(FACTORY_ADDRESS);

  await periphery.deployed();

  console.log("Periphery deployed to:", periphery.address);

  const Batcher = await hre.ethers.getContractFactory("PeripheryBatcher");
  const batcher = await Batcher.deploy(FACTORY_ADDRESS, periphery.address);

  await batcher.deployed();

  console.log("Batcher deployed to:", batcher.address);
  console.log("Batched Owner: ", await batcher.owner());

  const USDC = await hre.ethers.getContractAt("IERC20", STABLE_COIN_ADDRESS);
  const LP = await hre.ethers.getContractAt("IERC20", VAULT_ADDRESS);
  let balance = await USDC.balanceOf(accounts[0].address);
  console.log(balance.toString());

  await batcher.setVaultTokenAddress(
    `${VAULT_ADDRESS}`,
    `${STABLE_COIN_ADDRESS}`
  );

  console.log(
    "USDC balance before swap",
    (await USDC.balanceOf(accounts[0].address)).toString()
  );

  const WETH = await hre.ethers.getContractAt("IWETH9", WETH_ADDRESS);
  console.log(
    "balance of weth",
    (await WETH.balanceOf(accounts[0].address)).toString()
  );
  await WETH.deposit({ value: 10000000000000n });
  console.log(
    "balance of weth",
    (await WETH.balanceOf(accounts[0].address)).toString()
  );
  await WETH.approve(UNISWAP_ROUTER_ADDRESS, 10000000000000000000000000n);

  ISwapRouter = await hre.ethers.getContractAt(
    "ISwapRouter",
    UNISWAP_ROUTER_ADDRESS
  );
  // ISwapRouter.ExactInputSingleParams memory params =
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
  // swapRouter.exactInputSingle(params);

  console.log(
    "USDC balance after swap",
    (await USDC.balanceOf(accounts[0].address)).toString()
  );

  await USDC.approve(
    batcher.address,
    await USDC.balanceOf(accounts[0].address)
  );

  balance = await USDC.balanceOf(accounts[0].address);

  console.log("approved token for spend");

  await batcher.depositFunds(balance.div(10) , VAULT_ADDRESS);
  console.log(
    "USDC balance",
    (await USDC.balanceOf(accounts[0].address)).toString()
  );
  await batcher.depositFunds(balance.div(10), VAULT_ADDRESS);
  console.log(
    "USDC balance",
    (await USDC.balanceOf(accounts[0].address)).toString()
  );
  await batcher.depositFunds(balance.div(10), VAULT_ADDRESS);
  console.log(
    "USDC balance",
    (await USDC.balanceOf(accounts[0].address)).toString()
  );
  await batcher.depositFunds(balance.div(10),  VAULT_ADDRESS);
  console.log(
    "USDC balance",
    (await USDC.balanceOf(accounts[0].address)).toString()
  );

  console.log(
    "LP tokens earlier",
    (await LP.balanceOf(accounts[0].address)).toString()
  );

  await batcher.batchDepositPeriphery(VAULT_ADDRESS, [
    accounts[0].address,
    "0x140713bbD82113e104C3a45661134F9764807922",
  ], 500);

  console.log(
    "LP tokens after batch deposit",
    (await LP.balanceOf(accounts[0].address)).toString()
  );

  if (etherscan_verify) {
    await timeout(15000);
    await hre.run("verify:verify", {
      address: periphery.address,
      constructorArguments: [FACTORY_ADDRESS]
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
