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

/**
 * @title StakingTripleRewardsFactory
 * @notice Deploys staking contracts and distribute rewards from them
 */
contract StakingTripleRewardsFactory is Ownable {
    using SafeERC20 for IERC20;

    // info about rewards for a particular staking token
    struct StakingRewardsInfo {
        address stakingRewards;
        address[] rewardsTokens;
        uint256[] rewardAmounts;
        uint256 duration;
    }

    uint8 stakingRewardsCount;

    // rewards info by staking token
    mapping(uint8 => StakingRewardsInfo) public stakingRewardsInfo;

    error NotAContract();
    error AlreadyDeployed();
    error NotDeployed();
    error CalledBeforeAnyDeploys();

    constructor() {}

    /**
     * @notice Deploys a staking reward contract for setting rewards tokens and their amounts for pool 
     * and rewards distribution period. Can only be called by contract owner.
     * @param _rewardsTokens array of rewards tokens addresses
     * @param _rewardAmounts array of amounts of rewards in corresponding rewards tokens
     * @param rewardsDuration duration of rewards distribution
     */
    function deploy(
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

        StakingRewardsInfo storage info = stakingRewardsInfo[stakingRewardsCount++];

        if (info.stakingRewards != address(0)) revert AlreadyDeployed();

        info.stakingRewards = address(new StakingTripleRewards(
                address(this),
                _rewardsTokens
            )
        ); 
        
        for (uint8 i = 0; i < _rewardsTokens.length; ++i) {
            info.rewardsTokens[i] = _rewardsTokens[i];
            info.rewardAmounts[i] = _rewardAmounts[i];
        }

        info.duration = rewardsDuration;
    }

    /**
     * @notice Updates staking reward contract by its id for setting rewards tokens amounts for pool 
     * and rewards distribution period. Can only be called by contract owner.
     * @param stakingId id of staking rewards 
     * @param _rewardAmounts array of amounts of rewards in corresponding rewards tokens
     * @param rewardsDuration duration of rewards distribution
     */
    function update(uint8 stakingId, uint256[] calldata _rewardAmounts, uint256 rewardsDuration) public onlyOwner {
        StakingRewardsInfo storage info = stakingRewardsInfo[stakingId];
        if (info.stakingRewards == address(0)) revert NotDeployed();

        for (uint8 i = 0; i < _rewardAmounts.length; ++i) {
            info.rewardAmounts[i] = _rewardAmounts[i];
        }

        info.duration = rewardsDuration;
    }

    /**
     * @notice Calls notifyRewardAmounts for all staking rewards contracts. Can only be called by contract owner.
     */
    function notifyRewardAmounts() public {
        if (stakingRewardsCount == 0) revert CalledBeforeAnyDeploys();
        for (uint8 i = 0; i < stakingRewardsCount; ++i) {
            notifyRewardAmount(i);
        }
    }

    // notify reward amount for an individual staking rewards contract.
    // this is a fallback in case the notifyRewardAmounts costs too much gas to call for all contracts
    /**
     * @notice Notify reward amount for an individual staking rewards contract.
     * and rewards distribution period. Can only be called by contract owner.
     * @param stakingId id of staking rewards 
     */
    function notifyRewardAmount(uint8 stakingId) public onlyOwner {
        StakingRewardsInfo storage info = stakingRewardsInfo[stakingId];
        if (info.stakingRewards == address(0)) revert NotDeployed();

        uint256[] memory rewardAmounts;
        if (info.duration > 0) {
            for (uint i = 0; i < 3; i++) {
                rewardAmounts[i] = info.rewardAmounts[i];
                info.rewardAmounts[i] = 0;
            }

            uint256 duration = info.duration;
            info.duration = 0;

            for (uint i = 0; i < 3; i++) {
                if (rewardAmounts[i] > 0) {
                    IERC20(info.rewardsTokens[i]).safeTransfer(info.stakingRewards, rewardAmounts[i]);
                }
            }

            StakingTripleRewards(info.stakingRewards).notifyRewardAmount(rewardAmounts, duration);
        }
    }

    /**
     * @notice Rescues the amount of ERC20 token transferred to contract.
     * Can only be called by owner.
     * @param tokenAddress address of ERC20 token to rescue
     * @param tokenAmount amount of given ERC20 token
     */
    function pullExtraTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}