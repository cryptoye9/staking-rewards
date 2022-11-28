interface IStakingTripleRewards {
    // Views
    function lastTimeRewardApplicable() external view returns (uint256);

    function rewardPerToken(uint256 i) external view returns (uint256);
   
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    // Mutative
    function stake() payable external;
    
    function withdraw(uint256 amount) external;

    function getReward() external;

    function exit() external;
}