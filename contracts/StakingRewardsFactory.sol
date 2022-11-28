pragma solidity 0.8.7;

import "./StakingRewards.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract StakingTripleRewardsFactory is Ownable {
    using SafeERC20 for IERC20;
    
    // the reward tokens for which the rewards contract has been deployed
    address[] public rewardTokens;

    // info about rewards for a particular staking token
    struct StakingRewardsInfo {
        address stakingRewards;
        uint256 rewardAmount;
        uint256 duration;
    }

    // rewards info by staking token
    mapping(address => StakingRewardsInfo) public stakingRewardsInfoByRewardToken;
        
    event Deploy(address indexed rewardToken, uint256 rewardAmount, uint256 rewardsDuration);
    event Update(address indexed rewardToken, uint256 rewardAmount, uint256 rewardsDuration);
    event PullExtraTokens(address indexed token, uint256 amount);

    constructor() {}

    ///// permissioned functions

    // deploy a staking reward contract for the staking token, and store the reward amount
    // the reward will be distributed to the staking reward contract no sooner than the genesis
    function deploy(address rewardToken, uint rewardAmount, uint256 rewardsDuration) public onlyOwner {
        StakingRewardsInfo storage info = stakingRewardsInfoByRewardToken[rewardToken];
        require(info.stakingRewards == address(0), 'StakingRewardsFactory::deploy: already deployed');

        info.stakingRewards = address(new StakingRewards(address(this), rewardToken));
        info.rewardAmount = rewardAmount;
        info.duration = rewardsDuration;
        rewardTokens.push(rewardToken);

        emit Deploy(rewardToken, rewardAmount, rewardsDuration);
    }

    function update(address rewardToken, uint rewardAmount, uint256 rewardsDuration) public onlyOwner {
        StakingRewardsInfo storage info = stakingRewardsInfoByRewardToken[rewardToken];
        require(info.stakingRewards != address(0), 'StakingRewardsFactory::update: not deployed');

        info.rewardAmount = rewardAmount;
        info.duration = rewardsDuration;

        emit Update(rewardToken, rewardAmount, rewardsDuration);
    }

    ///// permissionless functions

    // call notifyRewardAmount for all staking tokens.
    function notifyRewardAmounts() public {
        require(rewardTokens.length > 0, 'StakingRewardsFactory::notifyRewardAmounts: called before any deploys');
        for (uint i = 0; i < rewardTokens.length; i++) {
            notifyRewardAmount(rewardTokens[i]);
        }
    }

    // notify reward amount for an individual staking token.
    // this is a fallback in case the notifyRewardAmounts costs too much gas to call for all contracts
    function notifyRewardAmount(address rewardToken) public {
        StakingRewardsInfo storage info = stakingRewardsInfoByRewardToken[rewardToken];
        require(info.stakingRewards != address(0), 'StakingRewardsFactory::notifyRewardAmount: not deployed');

        if (info.rewardAmount > 0 && info.duration > 0) {
            uint rewardAmount = info.rewardAmount;
            uint256 duration = info.duration;
            info.rewardAmount = 0;
            info.duration = 0;

            require(
                IERC20(rewardToken).transfer(info.stakingRewards, rewardAmount),
                'StakingRewardsFactory::notifyRewardAmount: transfer failed'
            );
            StakingRewards(info.stakingRewards).notifyRewardAmount(rewardAmount, duration);
        }
    }

    function pullExtraTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
        emit PullExtraTokens(token, amount);
    }
}