interface IStakingRewards {
    function lastTimeRewardApplicable() external view returns (uint256);
    function rewardPerToken() external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function stake() payable external;
    function withdraw(uint256 amount) external;
    function getReward() external;
    function exit() external;
}