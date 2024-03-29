import {
  call,
  fork,
  getContext,
  put,
  select,
  take,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';
import { createSocketChannel } from '../lib/styles/createSocketChannel';
import {
  getHistory,
  initGame,
  initHistory,
  openGameChannelSaga,
  updateNumOfSection,
} from './board';
import { closeChannel, openChannel } from './socket';

const INITIALIZE = 'control/INITIALIZE';
const SET_ROOMID = 'control/SET_ROOMID';
const JOIN_ROOM = 'control/JOIN';
const JOIN_ROOM_SUCCESS = 'control/JOIN_ROOM_SUCCESS';
const JOIN_ROOM_FAILURE = 'control/JOIN_ROOM_FAILURE';
const LEAVE_ROOM = 'control/LEAVE_ROOM';
const NEW_PLAYER = 'control/NEW_PLAYER';
const EXIT_USER = 'control/EXIT_USER';
const SEND_MESSAGE = 'control/SEND_MESSAGE';
const UPDATE_MESSAGE = 'control/UPDATE_MESSAGE';
const CHANGE_MESSAGE = 'control/CHANGE_MESSAGE';
const INIT_MESSAGE = 'control/INIT_MESSAGE';
const UPDATE_NOTICE = 'control/UPDATE_NOTICE';
const OPEN_SETTING = 'control/OPEN_SETTING';
const CLOSE_SETTING = 'control/CLOSE_SETTING';
const REQUEST_SETTING = 'control/REQUEST_SETTING';
const UPDATE_SETTING = 'control/UPDATE_SETTING';
const TOGGLE_READY = 'control/TOGGLE_READY';
const UPDATE_READY = 'control/UPDATE_READY';
const REQUEST_START_GAME = 'control/REQUEST_START_GAME';
const START_GAME = 'control/START_GAME';
const REQUEST_SURRENDER = 'control/REQUEST_SURRENDER';
const END_GAME = 'control/END_GAME';
const REQUEST_PUT_STONE = 'control/REQUEST_PUT_STONE';
const UPDATE_TURN = 'control/UPDATE_TURN';
const UPDATE_TIMER = 'control/UPDATE_TIMER';
const RESET_TIMER = 'control/RESET_TIMER';

export const initialize = () => ({
  type: INITIALIZE,
});
export const setRoomId = (roomId) => ({
  type: SET_ROOMID,
  payload: { roomId },
});
export const joinRoom = (roomId, username) => ({
  type: JOIN_ROOM,
  payload: { roomId, username },
});
export const leaveRoom = () => ({
  type: LEAVE_ROOM,
});
export const newPlayer = (player) => ({
  type: NEW_PLAYER,
  payload: player,
});
export const changeMessage = (text) => ({
  type: CHANGE_MESSAGE,
  payload: text,
});
export const sendMessage = () => ({
  type: SEND_MESSAGE,
});
export const updateNotice = (notice) => ({
  type: UPDATE_NOTICE,
  payload: { notice },
});
export const toggleReady = () => ({
  type: TOGGLE_READY,
});
export const requestStartGame = () => ({
  type: REQUEST_START_GAME,
});
export const openSetting = () => ({
  type: OPEN_SETTING,
});
export const closeSetting = () => ({
  type: CLOSE_SETTING,
});
export const confirmSetting = (options) => ({
  type: REQUEST_SETTING,
  payload: options,
});
export const requestSurrender = () => ({
  type: REQUEST_SURRENDER,
});
export const requestPutStone = (position) => ({
  type: REQUEST_PUT_STONE,
  payload: { position },
});
export const updateTurn = (idx) => ({
  type: UPDATE_TURN,
  payload: idx,
});
export const resetTimer = () => ({
  type: RESET_TIMER,
});

export function* openControlChannelSaga() {
  const { socket } = yield select((state) => state.socket);
  let channel;

  channel = yield call(createSocketChannel, socket, 'update');
  yield put(openChannel('update', channel));

  try {
    while (true) {
      const resp = yield take(channel);
      switch (resp.type) {
        case 'NEW_USER': {
          yield put({ type: NEW_PLAYER, payload: resp.username });
          break;
        }
        case 'EXIT_USER': {
          const { players, exitUser } = resp.payload;
          yield put({ type: EXIT_USER, payload: { players, exitUser } });
          break;
        }
        case 'MESSAGE': {
          const { username, content } = resp.payload;
          const message = {
            username,
            content,
            isSelf: false,
          };
          yield put({ type: UPDATE_MESSAGE, payload: message });
          break;
        }
        case 'TOGGLE_READY': {
          const { username } = resp.payload;
          yield put({ type: UPDATE_READY, payload: username });
          break;
        }
        case 'SETTING': {
          const { totalTime, numOfSection } = resp.payload;
          yield put({
            type: UPDATE_SETTING,
            payload: { totalTime, numOfSection },
          });
          yield put(initHistory());
          yield put({ type: RESET_TIMER });
          break;
        }
        case 'START': {
          const { turnIdx } = resp.payload;
          const { numOfSection } = yield select(
            (state) => state.control.setting
          );
          yield put(initGame(numOfSection));
          yield put({ type: RESET_TIMER });
          yield fork(openGameChannelSaga);
          yield fork(openTimerChannelSaga);
          yield put({ type: START_GAME, payload: { turnIdx } });
          break;
        }
        case 'START_ERROR': {
          const { message } = resp.payload;
          alert(message);
          break;
        }
        case 'END': {
          const { winnerIdx } = resp.payload;
          yield put({ type: END_GAME, payload: { winnerIdx } });
          yield put(closeChannel('game'));
          yield put(closeChannel('timer'));
          break;
        }
        case 'ANOTHER_CONNECTION': {
          yield put({
            type: JOIN_ROOM_FAILURE,
            payload: {
              type: 'ANOTHER_CONNECTION',
              message: '다른 기기에서 접속하였습니다.',
            },
          });
          yield put({ type: LEAVE_ROOM, payload: true });
          break;
        }
        default:
          break;
      }
    }
  } catch (e) {
    console.error(e);
  }
}

export function* openTimerChannelSaga() {
  const { socket } = yield select((state) => state.socket);
  let channel;

  channel = yield call(createSocketChannel, socket, 'timer');
  yield put(openChannel('timer', channel));

  try {
    while (true) {
      const remainTime = yield take(channel);
      yield put({ type: UPDATE_TIMER, payload: { remainTime } });
    }
  } catch (e) {
    console.error(e);
  }
}

function* joinRoomSaga(action) {
  const { roomId, username } = action.payload;
  yield put({ type: SET_ROOMID, payload: { roomId } });
  const { socket } = yield select((state) => state.socket);
  let channel;

  socket.emit('joinRoom', { roomId: roomId, username: username });
  channel = yield call(createSocketChannel, socket, 'responseJoinRoom');
  const resp = yield take(channel);

  if (resp.success) {
    const { players, isStarted, turnIdx, totalTime, numOfSection, history } =
      resp.data;

    yield put({
      type: JOIN_ROOM_SUCCESS,
      payload: {
        players,
        isStarted,
        turnIdx,
        totalTime,
        numOfSection,
        username,
      },
    });
    yield put(updateNumOfSection(numOfSection));
    yield fork(openControlChannelSaga);

    if (isStarted) {
      yield put(getHistory(history));
      yield fork(openGameChannelSaga);
      yield fork(openTimerChannelSaga);
    }
  } else {
    yield put({ type: JOIN_ROOM_FAILURE, payload: { message: resp.message } });
    yield put({ type: LEAVE_ROOM });
  }
}

function* leaveRoomSaga() {
  const { socket } = yield select((state) => state.socket);

  const history = yield getContext('history');
  history.push('/');

  yield put({ type: INITIALIZE });
  yield put(initHistory());

  const { joinError } = yield select((state) => state.control);
  if (joinError?.type === 'ANOTHER_CONNECTION') return;

  socket.emit('leaveRoom');
}

function* sendMessageSaga() {
  const { socket } = yield select((state) => state.socket);
  const { username } = yield select((state) => state.user);

  const chatInput = yield select((state) => state.control.chatInput);
  socket.emit('sendMessage', chatInput);
  const message = {
    username,
    isSelf: true,
    content: chatInput,
  };
  yield put({ type: UPDATE_MESSAGE, payload: message });
  yield put({ type: INIT_MESSAGE });
}

function* toggleReadySaga() {
  const { socket } = yield select((state) => state.socket);
  const { username } = yield select((state) => state.user);

  socket.emit('toggleReady');
  yield put({ type: UPDATE_READY, payload: username });
}

function* startGameSaga() {
  const { socket } = yield select((state) => state.socket);
  socket.emit('startGame');
}

function* confirmSettingSaga(action) {
  const { socket } = yield select((state) => state.socket);
  const { totalTime, numOfSection } = action.payload;
  socket.emit('updateSetting', { totalTime, numOfSection });
}

function* surrenderSaga() {
  const { socket } = yield select((state) => state.socket);
  const { myIdx } = yield select((state) => state.control);
  socket.emit('surrender', myIdx);
}

export function* controlSaga() {
  yield takeLatest(JOIN_ROOM, joinRoomSaga);
  yield takeLatest(LEAVE_ROOM, leaveRoomSaga);
  yield takeLatest(SEND_MESSAGE, sendMessageSaga);
  yield takeEvery(TOGGLE_READY, toggleReadySaga);
  yield takeLatest(REQUEST_START_GAME, startGameSaga);
  yield takeLatest(REQUEST_SURRENDER, surrenderSaga);
  yield takeLatest(REQUEST_SETTING, confirmSettingSaga);
}

const initialState = {
  isJoined: false,
  isOwner: null,
  roomId: null,
  players: [],
  myIdx: null,
  chatLog: [],
  chatInput: '',
  isStarted: false,
  turnIdx: null,
  isMyTurn: false,
  joinError: null,
  remainTime: 30,
  setting: {
    isOpen: false,
    totalTime: 30,
    numOfSection: null,
  },
};

function control(state = initialState, action) {
  switch (action.type) {
    case INITIALIZE: {
      return initialState;
    }
    case SET_ROOMID: {
      const { roomId } = action.payload;
      return {
        ...state,
        roomId,
      };
    }
    case JOIN_ROOM_SUCCESS: {
      const { players, isStarted, turnIdx, totalTime, numOfSection, username } =
        action.payload;
      const myIdx = players.findIndex((player) => player.username === username);
      const { isOwner } = players[myIdx];

      return {
        ...state,
        isJoined: true,
        joinError: null,
        isOwner,
        players,
        isStarted,
        myIdx,
        turnIdx,
        isMyTurn: myIdx === turnIdx,
        chatLog: state.chatLog.concat({
          type: 'NOTICE',
          message: `- ${username}님이 접속하였습니다 -`,
        }),
        setting: {
          ...state.setting,
          totalTime,
          numOfSection,
        },
      };
    }
    case JOIN_ROOM_FAILURE: {
      return {
        ...state,
        joinError: action.payload,
      };
    }
    case NEW_PLAYER: {
      const username = action.payload;
      return {
        ...state,
        players: state.players.concat({
          username,
          isReady: false,
        }),
        chatLog: state.chatLog.concat({
          type: 'NOTICE',
          message: `- ${username}님이 접속하였습니다 -`,
        }),
      };
    }
    case EXIT_USER: {
      const { players, exitUser } = action.payload;
      return {
        ...state,
        players: players,
        chatLog: state.chatLog.concat({
          type: 'NOTICE',
          message: `- ${exitUser}님이 나가셨습니다 -`,
        }),
        myIdx: 0,
        isOwner: true,
      };
    }
    case INIT_MESSAGE: {
      return {
        ...state,
        chatInput: '',
      };
    }
    case CHANGE_MESSAGE: {
      return {
        ...state,
        chatInput: action.payload,
      };
    }
    case UPDATE_MESSAGE: {
      const { username, isSelf, content } = action.payload;
      return {
        ...state,
        chatLog: state.chatLog.concat({
          type: 'CHAT',
          message: { username, isSelf, content },
        }),
      };
    }
    case UPDATE_NOTICE: {
      const { notice } = action.payload;
      return {
        ...state,
        chatLog: state.chatLog.concat({
          type: 'NOTICE',
          message: `- ${notice} -`,
        }),
      };
    }
    case UPDATE_READY: {
      return {
        ...state,
        players: state.players.map((player) =>
          player.username === action.payload
            ? { ...player, isReady: !player.isReady }
            : player
        ),
      };
    }
    case START_GAME: {
      const { turnIdx } = action.payload;
      return {
        ...state,
        isStarted: true,
        turnIdx,
        isMyTurn: state.myIdx === turnIdx,
        chatLog: state.chatLog.concat({
          type: 'NOTICE',
          message: '- 게임이 시작되었습니다 -',
        }),
      };
    }
    case END_GAME: {
      const { winnerIdx } = action.payload;
      return {
        ...state,
        isStarted: false,
        players: state.players.map((player) => ({
          ...player,
          isFirst: !player.isFirst,
          isReady: player.isOwner,
        })),
        turnIdx: null,
        isMyTurn: false,
        chatLog: state.chatLog.concat({
          type: 'NOTICE',
          message: `- ${
            winnerIdx === state.myIdx ? '승리' : '패배'
          }하였습니다 -`,
        }),
      };
    }
    case UPDATE_TURN: {
      const turnIdx = action.payload;
      return {
        ...state,
        turnIdx,
        isMyTurn: turnIdx === state.myIdx,
      };
    }
    case RESET_TIMER: {
      return {
        ...state,
        remainTime: state.setting.totalTime,
      };
    }
    case UPDATE_TIMER: {
      const { remainTime } = action.payload;
      return {
        ...state,
        remainTime,
      };
    }
    case OPEN_SETTING: {
      return {
        ...state,
        setting: {
          ...state.setting,
          isOpen: true,
        },
      };
    }
    case CLOSE_SETTING: {
      return {
        ...state,
        setting: {
          ...state.setting,
          isOpen: false,
        },
      };
    }
    case UPDATE_SETTING: {
      const { totalTime, numOfSection } = action.payload;
      return {
        ...state,
        setting: {
          isOpen: false,
          totalTime,
          numOfSection,
        },
      };
    }
    default:
      return state;
  }
}

export default control;
