import { combineReducers } from "redux";
import {
  DENY_PERMISSION,
  GRANT_PERMISSION,
  REQUEST_PERMISSION,
  LOAD_FROM_STORAGE,
  LOG_OUT,
  NEW_KEY_PAIR,
  NEW_PASSWORD
} from "./Actions";

function password(state = null, action) {
  switch (action.type) {
    case LOAD_FROM_STORAGE:
      return action.password;

    case LOG_OUT:
      return null;

    case NEW_KEY_PAIR:
      return null;

    case NEW_PASSWORD:
      return action.password;

    default:
      return state;
  }
}

function keyPair(state = null, action) {
  switch (action.type) {
    case LOAD_FROM_STORAGE:
      return action.keyPair;

    case LOG_OUT:
      return null;

    case NEW_KEY_PAIR:
      return action.keyPair;

    default:
      return state;
  }
}

function permissions(state = {}, action) {
  switch (action.type) {
    case GRANT_PERMISSION:
      let hostPermissions = {} || state[action.host];
      let answer = Object.assign({}, state);
      answer[action.host] = Object.assign(
        {},
        hostPermissions,
        action.permissions
      );

      return answer;

    case LOAD_FROM_STORAGE:
      return action.permissions;

    case LOG_OUT:
      return {};

    case NEW_KEY_PAIR:
      return {};

    default:
      return state;
  }
}

// The 'request' field holds an object with host + the permissions
// that are being requested, or null if there are none.
function request(state = null, action) {
  switch (action.type) {
    case DENY_PERMISSION:
      return null;
    case GRANT_PERMISSION:
      return null;
    case REQUEST_PERMISSION:
      return {
        host: action.host,
        permissions: action.permissions
      };

    case LOAD_FROM_STORAGE:
      return action.request || null;

    default:
      return state;
  }
}

export default combineReducers({ password, keyPair, permissions, request });
