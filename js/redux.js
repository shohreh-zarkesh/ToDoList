//import "./reducers/toDoListReducer"

//#region utilities

function kindOf(inp) {
  return Object.prototype.toString.call(inp).slice(8, -1).toLowerCase();
}

function isObject(inp) {
  return kindOf(inp) === "object";
}

function isFunction(inp) {
  return typeof inp === "function";
}

//#endregion

//#region Error
class ActionIsNotAnObject extends Error {
  constructor(action) {
    super(`Action should be an object but got ${kindOf(action)}`);
    this.name = "ActionIsNotAnObject";
  }
}

class ReducerIsNotAFunction extends Error {
  constructor(reducer) {
    super(`Reducer should be a function, but got "${kindOf(reducer)}"`);
    this.name = "ReducerIsNotAFunction";
  }
}

class InitialStateIsAFunction extends Error {
  constructor(reducer) {
    super("InitialState couldn't be a function");
    this.name = "InitialStateIsAFunction";
  }
}

class ActionHasNoType extends Error {
  constructor() {
    super(`Action should have a type.`);
    this.name = "ActionHasNoType";
  }
}

class ActionHasNoTarget extends Error {
  constructor() {
    super(`Action should have a target.`);
    this.name = "ActionHasNoTarget";
  }
}

class StoreIsInProcess extends Error {
  constructor() {
    super("Some Reducers may updating and are busy. please wait...");
    this.name = "StoreIsInProcess";
  }
}

("Some Reducers may updating and are busy. please wait...");

//#endregion

//#region createStore
function createStore(reducer, initialState) {
  if (!isFunction(reducer)) {
    throw new ReducerIsNotAFunction(reducer);
  }

  if (isFunction(initialState)) {
    throw new InitialStateIsAFunction();
  }

  let state = initialState;
  let followers = [];
  let isDispatching = false;

  function dispatch(action) {
    if (!isObject(action)) {
      throw new ActionIsNotAnObject(action);
    }

    if (!("type" in action)) {
      throw new ActionHasNoType();
    }

    const isInitType = action.type === "@INIT";
    if (!isInitType && !("target" in action)) {
      throw new ActionHasNoTarget();
    }

    if (isDispatching) {
      throw new StoreIsInProcess();
    }

    try {
      isDispatching = true;
      state = reducer(state, action);
    } finally {
      isDispatching = false;
      broadcast();
    }
  }

  function broadcast() {
    for (const follow of followers) {
      follow();
    }
  }

  function getState() {
    if (isDispatching) {
      throw new StoreIsInProcess();
    }

    return state;
  }

  function follow(followFn) {
    followers.push(followFn);

    return function unfollow() {
      const nodeIndex = followers.indexOf(followFn);

      if (nodeIndex >= 0) {
        followers.splice(nodeIndex, 1);
      }
    };
  }

  dispatch({
    type: "@INIT",
  });

  return {
    dispatch,
    getState,
    follow,
  };
}

//#endregion

//#region combineReducers
function shapeAssertionReducers(reducers) {
  Object.entries(reducers).forEach(([reducerKey, reducer]) => {
    const action = { type: "@INIT", target: reducerKey };
    const state = reducer(undefined, action);

    if (typeof state === "undefined") {
      throw new Error(
        `Reducer for key ${reducerKey} returns undefined for action ${JSON.stringify(
          action
        )}`
      );
    }

    const randomActionType = Math.random().toString(16).slice(2);
    const secondAction = { type: randomActionType, target: reducerKey };
    const secondState = reducer(undefined, secondAction);
    if (typeof secondState === "undefined") {
      throw new Error(
        `Reducer for key ${reducerKey} returns undefined for action ${JSON.stringify(
          secondAction
        )}`
      );
    }
  });
}

function combineReducers(reducers) {
  const finalReducers = {};

  for (const reducerKey in reducers) {
    const reducer = reducers[reducerKey];

    if (isFunction(reducer)) {
      finalReducers[reducerKey] = reducer;
    }
  }

  let shapeError;
  try {
    shapeAssertionReducers(finalReducers);
  } catch (e) {
    shapeError = e;
  }

  return (state = {}, action) => {
    if (shapeError) {
      throw shapeError;
    }

    let hasChanged = false;
    const nextState = state;
    if (action.type === "@INIT" || action.target === "*") {
      for (const reducerKey in finalReducers) {
        const reducer = finalReducers[reducerKey];
        const reducerState = state[reducerKey] || undefined;
        delete action.target;
        const newReducerState = reducer(reducerState, action);

        if (typeof newReducerState === "undefined") {
          throw new Error(
            `Reducer ${reducerKey} returns undefined for action's type ${action.type}.`
          );
        }

        hasChanged = hasChanged || reducerState !== newReducerState;

        nextState[reducerKey] = newReducerState;
      }
    } else {
      const reducerKey = action.target;
      if (!(reducerKey in finalReducers)) {
        throw new Error(`Target ${reducerKey} not found in reducers`);
      }
      const reducer = finalReducers[reducerKey];
      const reducerState = state[reducerKey] || undefined;
      delete action.target;
      const newReducerState = reducer(reducerState, action);

      if (typeof newReducerState === "undefined") {
        throw new Error(
          `Reducer ${reducerKey} returns undefined for action's type ${action.type}.`
        );
      }

      hasChanged = reducerState !== newReducerState;

      if (hasChanged) nextState[reducerKey] = newReducerState;
    }

    return hasChanged ? nextState : state;
  };
}

//#endregion


const store = createStore(
  combineReducers({
    toDoList: toDoListReducer,
  })
);

//---------------------------------------------------------------------------------

//#region reducers
function toDoListReducer(state = [], action) {
  switch (action.type) {
    case "ADD": {
      return [
        ...state,
        {
          id: action.payload.id,
          value: action.payload.value,
          checked: false,
        },
      ];
    }

    case "ONCLICK": {
      const index = state.findIndex((x) => x.id == action.payload.id);
      if (index != -1) state[index].checked = !state[index].checked;

      return state;
    }
    case "DELETE": {
      const id = action.payload.id;

      const newList = state.filter((list) => list.id !== id);
      return newList;
    }
    default:
      return state;
  }
}
//#endregion

const addListItem = document.querySelector("#add-list-item");

let i = 0;
addListItem.addEventListener("click", () => {
const itemValue = document.getElementById("list-item").value;
if (itemValue != "") {
  store.dispatch({
    type: "ADD",
    target: "toDoList",
    payload: {
      id: `item-${i + 1}`,
      value: itemValue,
    },
  });
  i++;
}
});

const unfollowAddChange = store.follow(() => {
renderList(store.getState().toDoList);
});

const listElm = document.querySelector("div.list-items");

function renderList(list) {
listElm.innerHTML = "";
for (const item of list) {
  createItem({
    id: item.id,
    value: item.value,
    checked: item.checked,
  });
}
}

function createItem({ id, value: valueText, checked }) {
const div = document.createElement("div");
div.setAttribute("id", id);
div.classList.add("list-item");

const divCheckBox = document.createElement("div");
const checkBox = document.createElement("input");
checkBox.setAttribute("id", `list-${id}`);
checkBox.setAttribute("type", "checkBox");
checkBox.classList.add("checkBox-item");
checkBox.checked = checked;
addOnClickEvnetListener(checkBox);

const checkBoxLabel = document.createElement("label");
//checkBoxLabel.setAttribute("for", id);
if (checked) checkBoxLabel.style.textDecorationLine = "line-through";
checkBoxLabel.append(valueText);

const divDeleteBtn = document.createElement("div");
const button = document.createElement("button");
button.textContent = "x";
button.classList.add("delete-btn");
addDeleteEvnetListener(button);

divCheckBox.append(checkBox);
divCheckBox.append(checkBoxLabel);
div.append(divCheckBox);
divDeleteBtn.append(button);
div.append(divDeleteBtn);

listElm.append(div);
}

function addDeleteEvnetListener(button) {
button.addEventListener("click", (event) => {
  const id = event.target.parentNode.parentNode.id;

  store.dispatch({
    type: "DELETE",
    target: "toDoList",
    payload: {
      id,
    },
  });
});
}

function addOnClickEvnetListener(checkBoxItem) {
checkBoxItem.addEventListener("mousedown", (event) => {
  const id = event.target.parentNode.parentNode.id;

  store.dispatch({
    type: "ONCLICK",
    target: "toDoList",
    payload: {
      id,
    },
  });
});
}
