const { expect } = require("chai");

const checkEqual = async (v1, v2) => {
  expect(v1).to.equal(v2);
};

const checkUnEqual = async (v1, v2) => {
  expect(v1).to.not.equal(v2);
};

const checkRevert = async (v1, v2) => {
  await expect(v1).to.be.revertedWith(v2);
};

const checkAbove = async (v1, v2) => {
  expect(v1).to.be.above(v2);
};

const checkBelow = async (v1, v2) => {
  expect(v1).to.be.below(v2);
};

module.exports = {
  checkEqual,
  checkUnEqual,
  checkRevert,
  checkAbove,
  checkBelow
};
