import { Updater } from "@tanstack/react-table";

export const setUpdatedState = (
    state: any, setterFunction: (x: any) => void, updater: Updater<any>
) => {
    if (typeof updater === "function") {
        const updated = updater(state);
        if (JSON.stringify(updated) != JSON.stringify(state))
            setterFunction(updated);
    }
};
