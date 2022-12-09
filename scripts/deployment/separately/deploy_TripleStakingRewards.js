// This is a script for deployment and automatically verification of all the contracts (`contracts/`)

const hre = require("hardhat");
const { ethers } = hre;
const { verify, getAddressSaver } = require("../utilities/helpers");
const path = require("path");
const deploymentAddresses = require("../deploymentAddresses.json")

const ver = async function verifyContracts(address, arguments) {
  await hre
      .run('verify:verify', {
          address: address,
          constructorArguments: arguments,
      }).catch((err) => console.log(err))
}

async function main() {
    const ETHER_INVESTMENT = ethers.utils.parseUnits('0.01');
    const REWARDS_AMOUNT = ethers.utils.parseUnits('1.0');

    const [deployer] = await ethers.getSigners();

    // Deployed contract address saving functionality
    const network = 'BSCSCAN_TESTNET'; // Getting of the current network
    // Path for saving of addresses of deployed contracts
    const addressesPath = path.join(__dirname, "../deploymentAddresses.json");
    // The function to save an address of a deployed contract to the specified file and to output to console
    const saveAddress = getAddressSaver(addressesPath, network, true);

    const rewardsToken1_address = deploymentAddresses.BSCSCAN_TESTNET.new.RewardsToken1;
    const rewardsToken2_address = deploymentAddresses.BSCSCAN_TESTNET.new.RewardsToken2;
    const rewardsToken3_address = deploymentAddresses.BSCSCAN_TESTNET.new.RewardsToken3;

    const rewardsToken1 = await ethers.getContractAt("RewardsToken", rewardsToken1_address)
    const rewardsToken2 = await ethers.getContractAt("RewardsToken", rewardsToken2_address)
    const rewardsToken3 = await ethers.getContractAt("RewardsToken", rewardsToken3_address)

    const StakingTripleRewardsFactory = (await ethers.getContractFactory("StakingTripleRewardsFactory")).connect(deployer);
    const stakingTripleRewardsFactory = await StakingTripleRewardsFactory.deploy();
    await stakingTripleRewardsFactory.deployed();
    saveAddress("stakingTripleRewardsFactory", stakingTripleRewardsFactory.address);

    await rewardsToken1.connect(deployer).transfer(stakingTripleRewardsFactory.address, REWARDS_AMOUNT)
    await rewardsToken2.connect(deployer).transfer(stakingTripleRewardsFactory.address, REWARDS_AMOUNT)
    await rewardsToken3.connect(deployer).transfer(stakingTripleRewardsFactory.address, REWARDS_AMOUNT)

    await stakingTripleRewardsFactory.connect(deployer).deploy([
        rewardsToken1_address, 
        rewardsToken2_address,   
        rewardsToken3_address
      ], [REWARDS_AMOUNT, REWARDS_AMOUNT, REWARDS_AMOUNT], 60 * 60 * 10
    )  

    await stakingTripleRewardsFactory.connect(deployer).notifyRewardAmounts()

    let stakingRewardsInfo = await stakingTripleRewardsFactory.stakingRewardsInfo(0)
    saveAddress("stakingTripleRewards", stakingRewardsInfo[0]);

    // Verification of the deployed contract
    await ver(stakingTripleRewardsFactory.address, []); 
    await ver(stakingRewardsInfo[0], [
      stakingTripleRewardsFactory.address, [
      rewardsToken1_address, 
      rewardsToken2_address, 
      rewardsToken3_address
    ]]);

    console.log("Deployment is completed.");
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
