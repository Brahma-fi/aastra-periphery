const hre = require("hardhat");
const { checkEqual, checkBelow, checkAbove } = require("./helper");

const { ethers } = hre;

const FACTORY_ADDRESS = "0x5fE99C34146C8edE7BCEB7bd6a15E0aAA81a591e";
const STRATEGY_MANAGER_ADDRESS = "0x140713bbD82113e104C3a45661134F9764807922";
const IMPERSONATION_ACCOUNT = "0xE177DdEa55d5A724515AF1D909a36543cBC4d93E";

let factoryInstance;
let vaultInstance;
let peripheryInstance;
let signer;

const getContract = async () => {
  factoryInstance = await ethers.getContractAt("IFactory", FACTORY_ADDRESS);

  const vaultAddress = await factoryInstance.managerVault(
    STRATEGY_MANAGER_ADDRESS
  );

  vaultInstance = await ethers.getContractAt("IVault", vaultAddress);

  signer = await ethers.getSigner(IMPERSONATION_ACCOUNT);

  const Periphery = await ethers.getContractFactory("Periphery");
  peripheryInstance = await Periphery.deploy(FACTORY_ADDRESS);

  await peripheryInstance.deployed();
};

const getTokenData = async () => {
  const token0Addr = await vaultInstance.token0();
  const token1Addr = await vaultInstance.token1();

  const token0 = await ethers.getContractAt("IERC20Metadata", token0Addr);
  const token1 = await ethers.getContractAt("IERC20Metadata", token1Addr);

  const token0bal = await token0.balanceOf(signer.address);
  const token1bal = await token1.balanceOf(signer.address);

  return { token0Addr, token1Addr, token0, token1, token0bal, token1bal };
};

const depositToVault = async (token, amount) => {
  await token.connect(signer).approve(peripheryInstance.address, amount);
  await peripheryInstance
    .connect(signer)
    .vaultDeposit(amount,"0x379c28627e0d2b219e69511fd4cb6cfa5db6d3f1" , 500, STRATEGY_MANAGER_ADDRESS);
};

const withdrawFromVault = async (shares) => {
  await vaultInstance
    .connect(signer)
    .approve(peripheryInstance.address, shares);
  await peripheryInstance
    .connect(signer)
    .vaultWithdraw(shares, STRATEGY_MANAGER_ADDRESS, false);
};

describe("UniswapPutPeriphery Tests", function () {
  before(async () => {
    await getContract();
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [IMPERSONATION_ACCOUNT]
    });
  });

  it("Should be deployed correctly", async () => {
    const factoryAddr = await peripheryInstance.factory();
    checkEqual(factoryAddr, FACTORY_ADDRESS);
  });

  it("Should deposit to vault correctly", async () => {
    const { token0bal, token0 } = await getTokenData();
    const amountToDeposit = token0bal.div(4);

    await depositToVault(token0, amountToDeposit);

    const newBalance = await token0.balanceOf(signer.address);
    checkBelow(newBalance, token0bal);
  });

  it("Should receive vault shares on deposit", async () => {
    const { token0bal, token0 } = await getTokenData();
    const oldShares = await vaultInstance.balanceOf(signer.address);

    const amountToDeposit = token0bal.div(4);
    await depositToVault(token0, amountToDeposit);

    const newShares = await vaultInstance.balanceOf(signer.address);
    checkAbove(newShares, oldShares);
  });

  it("Should withdraw correctly", async () => {
    const shares = await vaultInstance.balanceOf(signer.address);
    const { token0bal, token0 } = await getTokenData();

    await withdrawFromVault(shares.div(2));

    const newShares = await vaultInstance.balanceOf(signer.address);
    const newToken0Bal = await token0.balanceOf(signer.address);

    checkBelow(newShares, shares);
    checkAbove(newToken0Bal, token0bal);
  });
});
