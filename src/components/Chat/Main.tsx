import { DoublePanels } from "../Common/Body/DoublePanels";
import { Endpoint } from "@/types/chat/endpoints";
import { ChatWrapper } from "@/types/chat/chat";
import EndpointsTable from "./Endpoints/Main";
import ApiPreview from "./Preview/Main";
import Messaging from "./Messaging/Main";
import { chat } from "@/utils/chat/chat/server";
import { Sheet, SheetOverlay } from "../UI/sheet";

const Main = ({ apiKey, endpoints }: { 
    apiKey: string, 
    endpoints: Endpoint[]
}) => {
    // adding a chat wrapper to avoid passing an api key to a client component
    const chatWrapper = async ({ key, message, endpoints, parameters, prevResponses }: ChatWrapper) => {
        "use server";
        return chat({ key, message, endpoints, parameters, prevResponses, apiKey })
    };

    return <DoublePanels
        isLoading={false}
        first={<EndpointsTable endpoints={endpoints} /> }
            // <DoublePanels
            //     isLoading={false}
            //     first={<EndpointsTable endpoints={endpoints} />}
            //     second={<ApiPreview apiKey={apiKey} endpoints={endpoints}/>}
            //     direction="vertical"
            // />
        // }
        second={<Messaging endpoints={endpoints} chatWrapper={chatWrapper} />}
    />
};

export default Main;
