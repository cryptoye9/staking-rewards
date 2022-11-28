pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IStakingTripleRewards.sol";
import "./StakingTripleRewards.sol";

contract StakingRewardsFactory is Ownable {
    using SafeERC20 for IERC20;

    // the staking tokens for which the rewards contract has been deployed
    address[] public stakingTokens;

    // info about rewards for a particular staking token
    struct StakingRewardsInfo {
        address stakingRewards;
        address[] rewardsTokens;
        uint256[] rewardAmounts;
        uint256 duration;
    }

    // rewards info by staking token
    mapping(address => StakingRewardsInfo) public stakingRewardsInfoByStakingToken;

    error NotAContract();
    error AlreadyDeployed();
    error NotDeployed();
    error CalledBeforeAnyDeploys();

    constructor() {}

    ///// permissioned functions

    // deploy a staking reward contract for the staking token, and store the reward amount
    // the reward will be distributed to the staking reward contract no sooner than the genesis
    function deploy(
        address stakingToken,
        address[] calldata _rewardsTokens,
        uint256[] calldata _rewardAmounts,
        uint256 rewardsDuration
    )
        public
        onlyOwner
    {
        for (uint8 i = 0; i < _rewardsTokens.length; ++i) {
            if(!Address.isContract(_rewardsTokens[i])) revert NotAContract();
        }

        StakingRewardsInfo storage info = stakingRewardsInfoByStakingToken[stakingToken];

        if (info.stakingRewards != address(0)) revert AlreadyDeployed();

        info.stakingRewards = address(new StakingTripleRewards(
                address(this),
                _rewardsTokens,
                stakingToken
            )
        ); 
        
        for (uint8 i = 0; i < _rewardsTokens.length; ++i) {
            info.rewardsTokens[i] = _rewardsTokens[i];
            info.rewardAmounts[i] = _rewardAmounts[i];
        }

        info.duration = rewardsDuration;
        stakingTokens.push(stakingToken);
    }

    function update(address stakingToken, uint256[] calldata _rewardAmounts, uint256 rewardsDuration) public onlyOwner {
        StakingRewardsInfo storage info = stakingRewardsInfoByStakingToken[stakingToken];
        if (info.stakingRewards == address(0)) revert NotDeployed();

        for (uint8 i = 0; i < _rewardAmounts.length; ++i) {
            info.rewardAmounts[i] = _rewardAmounts[i];
        }

        info.duration = rewardsDuration;
    }



    ///// permissionless functions

    // call notifyRewardAmount for all staking tokens.
    function notifyRewardAmounts() public {
        if (stakingTokens.length == 0) revert CalledBeforeAnyDeploys();
        for (uint i = 0; i < stakingTokens.length; i++) {
            notifyRewardAmount(stakingTokens[i]);
        }
    }

    // notify reward amount for an individual staking token.
    // this is a fallback in case the notifyRewardAmounts costs too much gas to call for all contracts
    function notifyRewardAmount(address stakingToken) public {
        StakingRewardsInfo storage info = stakingRewardsInfoByStakingToken[stakingToken];
        if (info.stakingRewards == address(0)) revert NotDeployed();

        uint256[] memory rewardAmounts;
        if (info.duration > 0) {
            for (uint i = 0; i < stakingTokens.length; i++) {
                rewardAmounts[i] = info.rewardAmounts[i];
                info.rewardAmounts[i] = 0;
            }

            uint256 duration = info.duration;
            info.duration = 0;

            for (uint i = 0; i < stakingTokens.length; i++) {
                if (rewardAmounts[i] > 0) {
                    IERC20(info.rewardsTokens[i]).safeTransfer(info.stakingRewards, rewardAmounts[i]);
                }
            }

            StakingTripleRewards(info.stakingRewards).notifyRewardAmount(rewardAmounts, duration);
        }
    }

    function pullExtraTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(msg.sender, amount);
    }
}