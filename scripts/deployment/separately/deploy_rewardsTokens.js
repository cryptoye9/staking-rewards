const hre = require("hardhat");
const { ethers } = hre;
const { verify, getAddressSaver } = require("../utilities/helpers");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();

    // Deployed contract address saving functionality
    const network = 'BSCSCAN_TESTNET'; // Getting of the current network
    // Path for saving of addresses of deployed contracts
    const addressesPath = path.join(__dirname, "../deploymentAddresses.json");
    // The function to save an address of a deployed contract to the specified file and to output to console
    const saveAddress = getAddressSaver(addressesPath, network, true);

    const RewardsToken = (await ethers.getContractFactory("RewardsToken")).connect(deployer);
    const rewardsToken1 = await RewardsToken.deploy("RewardsToken1", "RT1");
    await rewardsToken1.deployed();

    const rewardsToken2 = await RewardsToken.deploy("RewardsToken2", "RT2");
    await rewardsToken2.deployed();    
    
    const rewardsToken3 = await RewardsToken.deploy("RewardsToken3", "RT3");
    await rewardsToken3.deployed(); 

    // Saving of an address of the deployed contract to the file
    saveAddress("RewardsToken1", rewardsToken1.address);
    saveAddress("RewardsToken2", rewardsToken2.address);
    saveAddress("RewardsToken3", rewardsToken3.address);

    // Verification of the deployed contract
    await verify(rewardsToken1.address, ["RewardsToken1", "RT1"]); 
    await verify(rewardsToken2.address, ["RewardsToken2", "RT2"]); 
    await verify(rewardsToken3.address, ["RewardsToken3", "RT3"]);

    console.log("Deployment is completed.");
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});