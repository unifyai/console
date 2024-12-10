"use client";

import { useState } from "react";
import Joyride, { ACTIONS, EVENTS, ORIGIN, STATUS, CallBackProps } from "react-joyride";
import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import ActionButton from "../../Common/Buttons/Action";
import { CircleHelp } from "lucide-react";
import TourSteps from "./Steps";

const Tour = ({buttonClassName}:{buttonClassName?: string}) => {

    // Initialize router
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const updateURLParams = useCallback(
      (name: string, value: string) => {
        const params = new URLSearchParams(searchParams!.toString());
        params.set(name, value);
        return params.toString();
      },
      [searchParams]
    );

    // Handle steps
    const steps = TourSteps(pathname);
    const [stepIndex, setStepIndex] = useState(0);
    const handleJoyrideCallback = (data: CallBackProps) => {
        const { action, index, origin, status, type } = data;
        if (action === ACTIONS.CLOSE) {
          router.push(pathname + "?" + updateURLParams("tutorial", "end"));
          setStepIndex(0);
        }
        if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type as "step:after" | "error:target_not_found")) {
          setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
        } else if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as "skipped" | "finished")) {
          router.push(pathname + "?" + updateURLParams("tutorial", "end"));
          setStepIndex(0);
        }
      };

    const onClick = () => {
        const tutorialParam = searchParams?.get("tutorial");
            tutorialParam != "start"
                ? router.push(pathname + "?" + updateURLParams("tutorial", "start"))
                : router.push(pathname + "?" + updateURLParams("tutorial", "end"));
    }
    const button   = <ActionButton icon={<CircleHelp/>} tooltip="Tutorial" onClick={onClick} className={buttonClassName}/>
    const tutorial = searchParams?.get("tutorial") === "start" && 
                    <Joyride
                        run={searchParams?.get("tutorial") === "start"}
                        stepIndex={stepIndex}
                        steps={steps}
                        continuous={true}
                        showProgress={true}
                        showSkipButton={true}
                        callback={handleJoyrideCallback}
                        styles={{
                            options: {
                            arrowColor: "white",
                            backgroundColor: "white",
                            //overlayColor: "rgba(92, 174, 171, .3)",
                            primaryColor: "green",
                            textColor: "black",
                            },
                            spotlight: {
                            backgroundColor: "transparent",
                            },
                        }}
                    />
    return  <> {button} {tutorial} </>;
};

export default Tour;
