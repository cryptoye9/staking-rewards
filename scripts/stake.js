// This is a script for deployment and automatically verification of all the contracts (`contracts/`)

const hre = require("hardhat");
const { ethers } = hre;
const path = require("path");
const deploymentAddresses = require("./deployment/deploymentAddresses.json")
const factoryABI = require("../abi/contracts/StakingTripleRewardsFactory.sol/StakingTripleRewardsFactory.json")
const stakingABI = require("../abi/contracts/StakingTripleRewards.sol/StakingTripleRewards.json")

async function main() {
    const ETHER_INVESTMENT = ethers.utils.parseUnits('0.0001');
    const REWARDS_AMOUNT = ethers.utils.parseUnits('1.0');

    const [deployer] = await ethers.getSigners();


    // Deployed contract address saving functionality
    // Path for saving of addresses of deployed contracts
    // The function to save an address of a deployed contract to the specified file and to output to console

    const StakingTripleRewardsFactory_addr = deploymentAddresses.BSCSCAN_TESTNET.new.stakingTripleRewardsFactory;

    const stakingTripleRewardsFactory = new ethers.Contract(StakingTripleRewardsFactory_addr, factoryABI, deployer)
    let stakingRewardsInfo = await stakingTripleRewardsFactory.stakingRewardsInfo(0)

    const stakingTripleRewards = new ethers.Contract(stakingRewardsInfo[0], stakingABI, deployer)
    await stakingTripleRewards.stake({  value: ETHER_INVESTMENT  })
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});