const { time, mine, mineUpTo } = require("@nomicfoundation/hardhat-network-helpers");

//const timeHelper = require("../utils/timeHelpers");
//const { DAY, ZERO } = require("../utils/constants");
const { utils , BigNumber} = require("ethers");
const { keccak256, toUtf8Bytes } = utils;

const { expect } = require("chai");
const { ethers, upgrades, waffle, network } = require("hardhat");
// const { both, increaseTime, mineBlock } = require("./Utils");
// const { time } = require("@nomicfoundation/hardhat-network-helpers");

//const abi = require("../abi/StakingRewards_abi.json")

let owner, user1, user2, user3, hacker1, hacker2, hacker3, rewardsTokenOwner
let StakingRewards1, StakingRewards2, StakingRewards3

let users = []

describe("StakingRewards", (accounts) => {
  const STAKING_POOLS_NUMBER = 3

  const DAY = 86400 // 1 day in seconds
  const REWARDS_AMOUNT = ethers.utils.parseUnits('100.0')

  beforeEach(async function () {
    [
      owner, 
      user1, 
      user2, 
      user3, 
      hacker1, 
      hacker2,
      hacker3,
      rewardsContractOwner,
      ...users
    ] = await ethers.getSigners();

    StakingRewards_Contract = await ethers.getContractFactory("StakingRewards")

    StakingRewardsFactory_Contract = await ethers.getContractFactory("StakingRewardsFactory")
    StakingRewardsFactory = await StakingRewardsFactory_Contract.deploy();

    RewardsToken_Contract = await ethers.getContractFactory("RewardsToken")
    RewardsToken1 = await RewardsToken_Contract.connect(rewardsContractOwner).deploy(
      "RewardsToken1", "RT1"
    ); 
    RewardsToken2 = await RewardsToken_Contract.connect(rewardsContractOwner).deploy(
      "RewardsToken2", "RT2"
    );
    RewardsToken3 = await RewardsToken_Contract.connect(rewardsContractOwner).deploy(
      "RewardsToken3", "RT3"
    );
    ExtraToken = await RewardsToken_Contract.connect(rewardsContractOwner).deploy(
      "ExtraToken", "EXTRA"
    );
  
  });


  describe("deploy and update staking", function () {

    it("deploy first staking (duration 30 days)", async function () {  
      await expect(StakingRewardsFactory.connect(owner).deploy(
        RewardsToken1.address,
        REWARDS_AMOUNT,
        30 * DAY
      )).to.emit(StakingRewardsFactory, 'Deploy').withArgs(
        RewardsToken1.address,
        REWARDS_AMOUNT, 
        30 * DAY
      );
      
      expect(await StakingRewardsFactory.stakingRewardsInfoByRewardToken(RewardsToken1.address))
        .to.not.equal(ethers.constants.AddressZero);
    });
    
    it("deploy second staking (duration 45 days)", async function () {  
      await expect(StakingRewardsFactory.connect(owner).deploy(
        RewardsToken2.address,
        REWARDS_AMOUNT,
        45 * DAY
      )).to.emit(StakingRewardsFactory, 'Deploy').withArgs(
        RewardsToken2.address,
        REWARDS_AMOUNT, 
        45 * DAY
      );

      expect(await StakingRewardsFactory.stakingRewardsInfoByRewardToken(RewardsToken1.address))
        .to.not.equal(ethers.constants.AddressZero);
    });

    it("deploy third staking (duration 60 days)", async function () {  
      await expect(StakingRewardsFactory.connect(owner).deploy(
        RewardsToken3.address,
        REWARDS_AMOUNT,
        60 * DAY
      )).to.emit(StakingRewardsFactory, 'Deploy').withArgs(
        RewardsToken3.address,
        REWARDS_AMOUNT, 
        60 * DAY
      );

      expect(await StakingRewardsFactory.stakingRewardsInfoByRewardToken(RewardsToken1.address))
        .to.not.equal(ethers.constants.AddressZero);
    });

    it("should revert when deploying staking with existing rewards token", async function () {  
      await expect(StakingRewardsFactory.connect(owner).deploy(
        RewardsToken3.address,
        REWARDS_AMOUNT,
        60 * DAY
      )).to.emit(StakingRewardsFactory, 'Deploy').withArgs(
        RewardsToken3.address,
        REWARDS_AMOUNT, 
        60 * DAY
      );

      const deployTx = StakingRewardsFactory.connect(owner).deploy(
        RewardsToken3.address,
        REWARDS_AMOUNT,
        60 * DAY
      )

      await expect(deployTx)
        .to.be.revertedWith("StakingRewardsFactory::deploy: already deployed")
    });

    it("should revert when calling notifyRewardAmounts before staking deployments", async function () {  
      const notifyRewardAmountsTx = StakingRewardsFactory.connect(owner).notifyRewardAmounts()

      await expect(notifyRewardAmountsTx)
        .to.be.revertedWith("StakingRewardsFactory::notifyRewardAmounts: called before any deploys")
    });

    it("notify reward amount after staking duration", async function () {  
      await StakingRewardsFactory.connect(owner).deploy(RewardsToken1.address, REWARDS_AMOUNT, 30 * DAY)
      await time.increase(100 * DAY)
      await RewardsToken1.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)
      await StakingRewardsFactory.connect(owner).notifyRewardAmounts()
    });
  })
    
    
  describe("notify rewards amounts", function () {

    beforeEach(async function () {
      await StakingRewardsFactory.connect(owner).deploy(RewardsToken1.address, REWARDS_AMOUNT, 30 * DAY)
      await StakingRewardsFactory.connect(owner).deploy(RewardsToken2.address, REWARDS_AMOUNT, 45 * DAY)
      await StakingRewardsFactory.connect(owner).deploy(RewardsToken3.address, REWARDS_AMOUNT, 60 * DAY)
    });
      
    it("should revert when calling Update staking before deployment by rewardsToken", async function () {  
      const updateTx = StakingRewardsFactory.connect(owner).update(
        ExtraToken.address, 
        REWARDS_AMOUNT,
        DAY
      )

      await expect(updateTx)
        .to.be.revertedWith("StakingRewardsFactory::update: not deployed")
    });

    it("update staking", async function () {  
      await expect(StakingRewardsFactory.connect(owner).update(
        RewardsToken1.address,
        REWARDS_AMOUNT,
        100 * DAY
      )).to.emit(StakingRewardsFactory, 'Update').withArgs(
        RewardsToken1.address,
        REWARDS_AMOUNT,
        100 * DAY
      );
    });

    it("notifyRewardAmounts for deployed staking", async function () {  
      expect(await RewardsToken1.balanceOf(StakingRewardsFactory.address)).to.equals('0');
      expect(await RewardsToken2.balanceOf(StakingRewardsFactory.address)).to.equals('0');
      expect(await RewardsToken3.balanceOf(StakingRewardsFactory.address)).to.equals('0');

      await RewardsToken1.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)
      await RewardsToken2.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)
      await RewardsToken3.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)

      expect(await RewardsToken1.balanceOf(StakingRewardsFactory.address)).to.equals(REWARDS_AMOUNT);
      expect(await RewardsToken2.balanceOf(StakingRewardsFactory.address)).to.equals(REWARDS_AMOUNT);
      expect(await RewardsToken3.balanceOf(StakingRewardsFactory.address)).to.equals(REWARDS_AMOUNT);

      await StakingRewardsFactory.connect(owner).notifyRewardAmounts()

      expect(await RewardsToken1.balanceOf(StakingRewardsFactory.address)).to.equals('0');
      expect(await RewardsToken2.balanceOf(StakingRewardsFactory.address)).to.equals('0');
      expect(await RewardsToken3.balanceOf(StakingRewardsFactory.address)).to.equals('0');
    });

    it("pull extra tokens", async function () {  
      expect(await ExtraToken.balanceOf(StakingRewardsFactory.address)).to.equals('0');
      await ExtraToken.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)

      await expect(StakingRewardsFactory.connect(owner).pullExtraTokens(ExtraToken.address, REWARDS_AMOUNT))
        .to.emit(StakingRewardsFactory, 'PullExtraTokens').withArgs(ExtraToken.address, REWARDS_AMOUNT);

      expect(await ExtraToken.balanceOf(StakingRewardsFactory.address)).to.equals('0');
    });
  })

  describe("deposit, rewards, withdraw", function () {
    const ETHER_INVESTMENT = ethers.utils.parseUnits('1.0')

    beforeEach(async function () {
      await StakingRewardsFactory.connect(owner).deploy(RewardsToken1.address, REWARDS_AMOUNT, 30 * DAY)
      await StakingRewardsFactory.connect(owner).deploy(RewardsToken2.address, REWARDS_AMOUNT, 45 * DAY)
      await StakingRewardsFactory.connect(owner).deploy(RewardsToken3.address, REWARDS_AMOUNT, 60 * DAY)

      let stakingRewardsInfo = await StakingRewardsFactory.stakingRewardsInfoByRewardToken(RewardsToken1.address)
      StakingRewards1 = await ethers.getContractAt("StakingRewards", stakingRewardsInfo.stakingRewards)
      stakingRewardsInfo = await StakingRewardsFactory.stakingRewardsInfoByRewardToken(RewardsToken2.address)
      StakingRewards2 = await ethers.getContractAt("StakingRewards", stakingRewardsInfo.stakingRewards)
      stakingRewardsInfo = await StakingRewardsFactory.stakingRewardsInfoByRewardToken(RewardsToken3.address)
      StakingRewards3 = await ethers.getContractAt("StakingRewards", stakingRewardsInfo.stakingRewards)

      await RewardsToken1.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)
      await RewardsToken2.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)
      await RewardsToken3.connect(rewardsContractOwner).transfer(StakingRewardsFactory.address, REWARDS_AMOUNT)
      await StakingRewardsFactory.connect(owner).notifyRewardAmounts()
    });

    describe("deposit", function () {  
      beforeEach(async function () {

      });
        
      it("deposit Ether", async function () {  
        let stakingRewardsInfo = await StakingRewardsFactory.stakingRewardsInfoByRewardToken(RewardsToken1.address)
        const balanceBeforeDeposit = await ethers.provider.getBalance(user1.address)
        const tx = await StakingRewards1.connect(user1).stake({  value: ETHER_INVESTMENT  })
        const balanceAfterDeposit = await ethers.provider.getBalance(user1.address)
  
        const txReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  
        const txFee = (txReceipt.cumulativeGasUsed).mul(txReceipt.effectiveGasPrice)
        expect(balanceAfterDeposit).to.equal(balanceBeforeDeposit.sub(ETHER_INVESTMENT).sub(txFee))
      });

      it("reverts when depositing 0 Ether", async function () {  
        const balanceBeforeDeposit = await ethers.provider.getBalance(user1.address)
        const tx = StakingRewards1.connect(user1).stake({  value: 0  })
        await expect(tx).to.be.revertedWith("Cannot stake 0")
      });
  
    })

    describe("getReward", function () {  
      beforeEach(async function () {
        await StakingRewards1.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards1.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards1.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user3).stake({  value: ETHER_INVESTMENT  })

      });
        
      it("earned", async function () {  
        await time.increase(DAY)
        expect(await StakingRewards1.earned(user1.address)).to.be.gt(await StakingRewards1.earned(user2.address));
        expect(await StakingRewards1.earned(user2.address)).to.be.gt(await StakingRewards1.earned(user3.address));
        expect(await StakingRewards2.earned(user1.address)).to.be.gt(await StakingRewards2.earned(user2.address));
        expect(await StakingRewards2.earned(user2.address)).to.be.gt(await StakingRewards2.earned(user3.address));
        expect(await StakingRewards3.earned(user1.address)).to.be.gt(await StakingRewards3.earned(user2.address));
        expect(await StakingRewards3.earned(user2.address)).to.be.gt(await StakingRewards3.earned(user3.address));

        expect(await StakingRewards1.earned(user1.address)).to.be.gt(await StakingRewards2.earned(user1.address));
        expect(await StakingRewards2.earned(user1.address)).to.be.gt(await StakingRewards3.earned(user1.address));

      });

      let earned;
      it("user1 gets reward", async function () {  
        await time.increase(DAY)

        await expect(StakingRewards1.connect(user1).getReward())
        earned = await StakingRewards1.earned(user2.address) // to know rewards of user2 after user1 gets reward (same deposit)
      });

      it("user2 gets reward", async function () {  
        await time.increase(DAY)
        const balanceBefore = await RewardsToken1.balanceOf(user2.address)
        await expect(StakingRewards1.connect(user2).getReward())
          .to.emit(StakingRewards1, 'RewardPaid').withArgs(user2.address, earned);
          
        const balanceAfter = await RewardsToken1.balanceOf(user2.address)
        expect(balanceAfter).to.equal(balanceBefore.add(earned))
      });
    })

    describe("withdraw", function () {  
      beforeEach(async function () {
        await StakingRewards1.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards1.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards1.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await time.increase(365 * DAY)

      });
        
      it("user1 withdraws Ether", async function () {  
        await expect(StakingRewards1.connect(user1).withdraw(ETHER_INVESTMENT))
          .to.emit(StakingRewards1, 'Withdrawn').withArgs(user1.address, ETHER_INVESTMENT);
      });

      it("user2 withdraws Ether", async function () {  
        const balanceBeforeWithdraw = await ethers.provider.getBalance(user2.address)
        const tx = await StakingRewards1.connect(user2).withdraw(ETHER_INVESTMENT)
        const balanceAfterWithdraw = await ethers.provider.getBalance(user2.address)
  
        const txReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  
        const txFee = (txReceipt.cumulativeGasUsed).mul(txReceipt.effectiveGasPrice)
        expect(balanceBeforeWithdraw).to.equal(balanceAfterWithdraw.sub(ETHER_INVESTMENT).add(txFee))
      });

      it("reverts when withdrawing 0 Ether", async function () {  
        const tx = StakingRewards1.connect(user1).withdraw('0')
        await expect(tx).to.be.revertedWith("Cannot withdraw 0")
      });

      it("user2 exits staking", async function () {  
        const balanceBeforeWithdraw = await ethers.provider.getBalance(user2.address)
        const tx = await StakingRewards1.connect(user2).exit()
        const balanceAfterWithdraw = await ethers.provider.getBalance(user2.address)
        const txReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
        const txFee = (txReceipt.cumulativeGasUsed).mul(txReceipt.effectiveGasPrice)
        expect(balanceBeforeWithdraw).to.equal(balanceAfterWithdraw.sub(ETHER_INVESTMENT).add(txFee))
      });
    
    })
    
    describe("view methods", function () {  
      beforeEach(async function () {
        await StakingRewards1.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user1).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards1.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user2).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards1.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards2.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await StakingRewards3.connect(user3).stake({  value: ETHER_INVESTMENT  })
        await time.increase(DAY)

      });
        
      it("staking total supply", async function () {  
        expect(await StakingRewards1.totalSupply()).to.be.equal(ETHER_INVESTMENT.mul(3));
        expect(await StakingRewards2.totalSupply()).to.be.equal(ETHER_INVESTMENT.mul(3));
        expect(await StakingRewards3.totalSupply()).to.be.equal(ETHER_INVESTMENT.mul(3));
      });

      it("staking total supply", async function () {  
        expect(await StakingRewards1.balanceOf(user1.address)).to.be.equal(ETHER_INVESTMENT);
        expect(await StakingRewards2.balanceOf(user1.address)).to.be.equal(ETHER_INVESTMENT);
        expect(await StakingRewards3.balanceOf(user1.address)).to.be.equal(ETHER_INVESTMENT);
      });
    })
  })
});

