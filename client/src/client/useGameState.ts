import { useReducer } from "react";
import type { ActionPayload, GameState } from "../types";
import { progressGame, initGame } from "./engine";

const initialState = {
  playerId: "",
  feedback: "",
  turnCount: 0,
  snapshot: initGame(),
  validated: [],
  optimistic: [],
  cooldowns: {
    basic: 1,
    bomb: 2,
    diag_cross: 3,
  },
  startAt: null,
  lobbies: [],
};

const useGameState = () => {
  return useReducer(reducer, {
    ...initialState,
  } as ClientState);
};

const reducer = (state: ClientState, event: ClientEvent): ClientState => {
  switch (event.type) {
    case "RECEIVED_START": {
      const { playerId, peerIds, startAt } = event.payload;
      return {
        ...state,
        playerId,
        snapshot: initGame({ playerId, peerIds }),
        startAt,
      };
    }

    case "RECEIVED_ACTION": {
      const optimistic = [...state.optimistic];
      const { snapshot, validated } = updateSnapshot(
        state.snapshot,
        state.validated,
        event.payload.turnCount - 1
      );

      validated.push(event.payload);
      if (event.payload.playerId === state.playerId) {
        optimistic.shift();
      }

      return { ...state, snapshot, validated, optimistic };
    }

    case "INPUT": {
      let ability = event.payload.projectileType;
      let cooldowns = { ...state.cooldowns };

      if (ability) {
        const isCoolingDown =
          cooldowns[ability] !== 0 &&
          cooldowns[ability] < initialState.cooldowns[ability];

        if (!isCoolingDown) {
          cooldowns[ability] =
            initialState.cooldowns[ability] +
            (event.payload.turnCount - state.turnCount) +
            1;
        }
      }

      const optimistic = [...state.optimistic, event.payload];
      return { ...state, optimistic, cooldowns };
    }

    case "FEEDBACK": {
      return { ...state, feedback: event.payload };
    }

    case "TICK": {
      const cooldowns = updateCooldowns(state);
      return { ...state, turnCount: state.turnCount + 1, cooldowns };
    }

    case "YOU": {
      const playerId = event.payload;
      return { ...state, playerId };
    }

    case "RECEIVED_LOBBIES": {
      const { lobbies } = event.payload;

      return { ...state, lobbies };
    }
  }
};

const updateSnapshot = (
  snapshot: ClientState["snapshot"],
  validated: ClientState["validated"],
  turnCount: number
) => {
  if (snapshot.turnCount < turnCount) {
    snapshot = progressGame(snapshot, validated, turnCount);
    validated = validated.filter((action) => action.turnCount > turnCount);
  }
  return { snapshot, validated };
};

const updateCooldowns = (state: ClientState) => {
  return (
    Object.keys(state.cooldowns) as [keyof ClientState["cooldowns"]]
  ).reduce(
    (res, key) => {
      if (state.cooldowns[key] > 0) {
        res[key] = state.cooldowns[key] - 1;
      } else {
        res[key] = 0;
      }
      return res;
    },
    {} as ClientState["cooldowns"]
  );
};

export interface ClientState {
  playerId: string;
  turnCount: number;
  feedback: string;
  snapshot: GameState;
  validated: ActionPayload[];
  optimistic: ActionPayload[];
  startAt: number | null;
  cooldowns: { basic: number; bomb: number; diag_cross: number };
  lobbies: {
    id: string;
    playerIds: string[];
  }[];
}

export type ClientEvent =
  | { type: "RECEIVED_ACTION"; payload: ActionPayload }
  | { type: "INPUT"; payload: ActionPayload }
  | { type: "FEEDBACK"; payload: string }
  | { type: "TICK" }
  | { type: "YOU"; payload: string }
  | {
      type: "RECEIVED_START";
      payload: { playerId: string; peerIds: string[]; startAt: number };
    }
  | {
      type: "RECEIVED_LOBBIES";
      payload: {
        lobbies: {
          id: string;
          playerIds: string[];
        }[];
      };
    };

export default useGameState;
