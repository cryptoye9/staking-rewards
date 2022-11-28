pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IStakingTripleRewards.sol";


contract TripleRewardsDistributionRecipient is Ownable {
    address public TripleRewardsDistribution;
    error Forbidden();

    modifier onlyTripleRewardsDistribution() {
        if (msg.sender != TripleRewardsDistribution) revert Forbidden();
        _;
    }
}

contract StakingTripleRewards is IStakingTripleRewards, TripleRewardsDistributionRecipient, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20[] public rewardsTokens;
    uint256 public periodFinish = 0;
    uint256[] public rewardRates;
    uint256 public lastUpdateTime;
    uint256[] public rewardPerTokensStored;

    mapping(address => uint256[]) public userRewardPerTokensPaid;
    mapping(address => uint256[]) public rewardPerTokens;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    
    error NotAContract();
    error ZeroAmount();
    error CannotReduceExistingPeriod();
    error ProvidedRewardTooHigh();

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _TripleRewardsDistribution,
        address[] memory _rewardsTokens
    ) public {
        // todo: add checks for not the same tokens
        for (uint8 i = 0; i < _rewardsTokens.length; ++i) {
            if (!Address.isContract(_rewardsTokens[i])) revert NotAContract();
            rewardsTokens[i] = IERC20(_rewardsTokens[i]);
        }
        TripleRewardsDistribution = _TripleRewardsDistribution;
    }

    /* ========== VIEWS ========== */

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function lastTimeRewardApplicable() public view override returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function rewardPerToken(uint index) public view override returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokensStored[index];
        }
        return rewardPerTokensStored[index] + (lastTimeRewardApplicable() - lastUpdateTime) * rewardRates[index] * 1e18 / _totalSupply;
    }

    function earnedPerToken(address account, uint8 index) public view returns (uint256) {
        return _balances[account] * (rewardPerToken(index) - userRewardPerTokensPaid[account][index]) / 1e18 + rewardPerTokens[account][index];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake() payable external override nonReentrant updateReward(msg.sender) {
        if (msg.value == 0) revert ZeroAmount();
        _totalSupply += msg.value;
        _balances[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public override nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        _totalSupply -= amount;
        _balances[msg.sender] -= amount;
        Address.sendValue(payable(msg.sender), amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) override {
        for (uint8 i = 0; i < 3; ++i) {
            if (rewardPerTokens[msg.sender][i] > 0) {
                uint256 rewardAmount = rewardPerTokens[msg.sender][i];
                rewardPerTokens[msg.sender][i] = 0;
                rewardsTokens[i].safeTransfer(msg.sender, rewardAmount);
                emit RewardPaid(msg.sender, address(rewardsTokens[i]), rewardAmount);
            }
        }
    }

    function exit() external override {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256[] calldata rewardAmounts, uint256 rewardsDuration) external onlyTripleRewardsDistribution updateReward(address(0)) {
        if ((block.timestamp + rewardsDuration) < periodFinish) revert CannotReduceExistingPeriod();

        if (block.timestamp >= periodFinish) {
            for (uint8 i = 0; i < 3; ++i) {
                rewardRates[i] = rewardAmounts[i] / rewardsDuration;
            }
        } else {
            uint256 remaining = periodFinish - block.timestamp;

            uint256 leftover;
            for (uint8 i = 0; i < 3; ++i) {
                leftover = remaining * rewardRates[i];
                rewardRates[i] = (rewardAmounts[i] + leftover) / rewardsDuration;
            }
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balancePerToken;
        for (uint8 i = 0; i < 3; ++i) {
            balancePerToken = rewardsTokens[i].balanceOf(address(this));
            if (rewardRates[i] > (balancePerToken / rewardsDuration)) revert ProvidedRewardTooHigh();
        }

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(rewardAmounts, periodFinish);
    }

    // Added to support recovering LP Rewards in case of emergency
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        IERC20(tokenAddress).safeTransfer(msg.sender, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }

    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        for (uint8 i = 0; i < 3; ++i) {
            lastUpdateTime = lastTimeRewardApplicable();
            if (account != address(0)) {
                rewardPerTokens[account][i] = earnedPerToken(account, i);
                userRewardPerTokensPaid[account][i] = rewardPerToken(i);
            } 
        }        
        _;
    }

    /* ========== EVENTS ========== */

    event RewardAdded(uint256[] rewardTokens, uint256 periodFinish);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, address rewardToken, uint256 reward);
    event Recovered(address token, uint256 amount);
}