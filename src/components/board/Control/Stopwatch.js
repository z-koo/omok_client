import React, { useMemo } from 'react';
import styled from 'styled-components';
import { palette } from '../../../lib/styles/palette';

function Stopwatch({ totalTime, remainTime, isStarted }) {
  const remainRatio = useMemo(
    () => (remainTime / totalTime) * 100,
    [remainTime, totalTime]
  );

  return (
    <StopwatchBlock>
      <TimerBar remainRatio={remainRatio} isStarted={isStarted}></TimerBar>
      <RemainSec>{remainTime}</RemainSec>
    </StopwatchBlock>
  );
}

const StopwatchBlock = styled.div`
  background: ${palette.darkwoodThree[4]};
  color: #fff;
  padding: 5px;
  overflow-x: hidden;
  position: relative;
`;
const TimerBar = styled.div`
  height: 1.3rem;
  background: ${(props) =>
    props.isStarted ? '#b73' : palette.darkwoodThree[0]};
  width: ${(props) => `${props.remainRatio}%`};
`;

const RemainSec = styled.div`
  font-size: 0.9rem;
  font-weight: bold;
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
`;

export default React.memo(Stopwatch);
