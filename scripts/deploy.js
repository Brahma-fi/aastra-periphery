const hre = require("hardhat");

const etherscan_verify = true;

const FACTORY_ADDRESS = "0xBAD59D2BA9A532242F1287DeaBc4227E8150D074";
const PERIPHERY_ADDRESS = "0xd47eE04a6f3c9739007D311962279eb5b2c856C5";
const VAULT_ADDRESS = "0xc10d2E42dE16719523aAA9277d1b9290aA6c3Ad5";
const STABLE_COIN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const accounts = await hre.ethers.getSigners();
  console.log(
    "current acc balance",
    (await hre.ethers.provider.getBalance(accounts[0].address)).toString()
  );

  const Batcher = await hre.ethers.getContractFactory("PeripheryBatcher");
  const batcher = await Batcher.deploy(FACTORY_ADDRESS, PERIPHERY_ADDRESS);

  await batcher.deployed();

  console.log("Batcher deployed to:", batcher.address);
  console.log("Batched Owner: ", await batcher.owner());


  await batcher.setVaultTokenAddress(
    `${VAULT_ADDRESS}`,
    `${STABLE_COIN_ADDRESS}`
  );


  if (etherscan_verify) {
    await timeout(15000);
    await hre.run("verify:verify", {
      address: batcher.address,
      constructorArguments: [FACTORY_ADDRESS, PERIPHERY_ADDRESS]
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
