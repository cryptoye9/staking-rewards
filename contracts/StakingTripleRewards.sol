pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IStakingTripleRewards.sol";


contract TripleRewardsDistributionRecipient is Ownable {
    address public TripleRewardsDistribution;

    modifier onlyTripleRewardsDistribution() {
        require(msg.sender == TripleRewardsDistribution, "Caller is not TripleRewardsDistribution contract");
        _;
    }
}

contract IStakingTripleRewards is IStakingTripleRewards, TripleRewardsDistributionRecipient, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20[] public rewardsTokens;
    IERC20 public stakingToken;
    uint256 public periodFinish = 0;
    uint256[] public rewardRates;
    uint256 public lastUpdateTime;
    uint256[] public rewardPerTokensStored;

    mapping(address => uint256[]) public userRewardPerTokensPaid;
    mapping(address => uint256[]) public rewardPerTokens;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    
    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _TripleRewardsDistribution,
        address[] memory _rewardsTokens,
        address _stakingToken
    ) public {
        // todo: add checks for not the same tokens
        for (uint8 i = 0; i < _rewardsTokens.length; ++i) {
            require(Address.isContract(_rewardsTokens[i]), "Not a contract");
            rewardsTokens[i] = IERC20(_rewardsTokens[i]);
        }
        stakingToken = IERC20(_stakingToken);
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
        return
            rewardPerTokensStored[index].add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRates[index]).mul(1e18).div(_totalSupply)
            );
    }

    function earnedPerToken(address account, uint8 index) public view returns (uint256) {
        return _balances[account].mul(rewardPerToken(index).sub(userRewardPerTokensPaid[account][index])).div(1e18).add(rewardPerTokens[account][index]);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) override {
        require(amount > 0, "Cannot stake 0");
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) override {
        require(amount > 0, "Cannot withdraw 0");
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        stakingToken.safeTransfer(msg.sender, amount);
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
        require(block.timestamp.add(rewardsDuration) >= periodFinish, "Cannot reduce existing period");

        if (block.timestamp >= periodFinish) {
            for (uint8 i = 0; i < 3; ++i) {
                rewardRates[i] = rewardAmounts[i].div(rewardsDuration);
            }
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);

            uint256 leftover;
            for (uint8 i = 0; i < 3; ++i) {
                leftover = remaining.mul(rewardRates[i]);
                rewardRates[i] = rewardAmounts[i].add(leftover).div(rewardsDuration);
            }
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balancePerToken;
        for (uint8 i = 0; i < 3; ++i) {
            balancePerToken = rewardsTokens[i].balanceOf(address(this));
            require(rewardRates[i] <= balancePerToken.div(rewardsDuration), "Provided reward too high");
        }

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(rewardsDuration);
        emit RewardAdded(rewardAmounts, periodFinish);
    }

    // Added to support recovering LP Rewards in case of emergency
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(stakingToken), "Cannot withdraw the staking token");
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