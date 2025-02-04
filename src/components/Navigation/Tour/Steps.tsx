const step = (target: string, content: string) => {
    return {target, content, disableBeacon: true}
}

const Steps = {
    "/interfaces" :   [
                        step("body", "Welcome to Unify! This guided tour will walk you through the projects page where you can visualize your LLM evaluations."),
                        step(".tutorial-logs-table", "The logs table is the main interface that shows all your logged experiments in tabular format. You can customize the table with different sorting, ordering, grouping, etc. to create the view that best fits your needs. This view will be saved in the URL for reuse."),
                        step(".tutorial-details-panel", "This section contains additional modules that help explore your logs data in-depth. You can switch between the different modules using the tabs."),
                        step(".tutorial-selection-pane", "The selection panel allows you to view in details any log on the table with arbitrary nesting. You can notably use this panel to get a side-by-side comparison of any given log against other entries."),
                        step(".tutorial-datasets-pane", "The datasets panel displays all the logs grouped in a given dataset. You can learn more about integrating your logs in datasets in our documentation."),
                        step(".tutorial-plot-pane", "Finally, the plot panel allows you to visualize your data with different plot types to find interesting trends or insights."),
                        step("body", "You are now ready to start exploring your LLM evaluations. You can click on this button to go through the tour again, or click on the same button in other pages to get started with them."),
                    ],
    "/chat" :       [
                        step("body", "This tour will walk you through the chat interface and how to query LLMs with Unify."),
                        step(".tutorial-endpoints-table", "This table displays all the LLM endpoints supported by the Unify. You can select one or multiple endpoints to chat with from this table."),
                        step(".tutorial-api-preview", "The same endpoints can be queried directly through the Unify API using various SDKs. This code preview provides you with quickstart code snippets for each language."),
                        step(".tutorial-chat-interface", "The chat interface lets you query endpoints selected from the table using the Unify API behind the scenes."),
                        step("body", "You are now ready to start querying LLM endpoints using Unify. You can click on this button to go through the tour again."),
                    ],
    "/keys" :       [
                        step("body", "This tour will walk you through the keys page and how to query LLMs with Unify."),
                        step(".tutorial-unify-key", "This is your Unify API key that you can use to query our endpoints, log your evaluations or interact with any other Unify endpoint."),
                        step(".tutorial-provider-keys", "You can add a provider key to directly query endpoints we support using your personal provider account balance instead of your Unify account credits."),
                        step(".tutorial-custom-keys", "Conversely, you can add custom keys to query other custom endpoints not supported by Unify or query your own private endpoints."),
                        step("body", "You are now ready to manage your API keys through Unify. You can click on this button to go through the tour again."),
                    ],
    "/endpoints" :  [
                        step("body", "This tour will walk you through the custom endpoints page."),
                        step(".tutorial-add-custom-endpoint", "You can add a custom endpoint that can be queried with the Unify API. Custom endpoints can be any endpoint from a provider not supported by Unify, or your own private endpoints."),
                        step(".tutorial-custom-endpoints-table", "Uploaded endpoints will be displayed here. Custom endpoints can be called from the Unify API by passing the name or the model argument if specified. You can learn more about this in our docs."),
                        step("body", "You are now ready to manage add your custom endpoints to Unify. You can click on this button to go through the tour again."),
                    ],
    "/billing"  :   [
                        step("body", "This tour will walk you through the custom endpoints page."),
                        step(".tutorial-credits-balance", "Your credits balance is displayed here. You can top-up your balance either manually, automatically or both."),
                        step(".tutorial-automatic-refill", "You can consult your billing profile to manage your payment methods, download invoices and edit your billing profile."),
                        step(".tutorial-billing-portal", "You can consult your billing profile to manage your payment methods, download invoices and edit your billing profile."),
                        step("body", "You are now ready to manage add your custom endpoints to Unify. You can click on this button to go through the tour again."),
                    ],
    "/usage" :      [
                        step("body", "This tour will walk you through your API usage page. This page tracks your API calls to the various LLM endpoints."),
                        step(".tutorial-prompts-history", "This table displays a history of your input prompts along with relevant metadata."),
                        step(".tutorial-calls-plot", "The following plot shows a count of API calls per period."),
                        step(".tutorial-tokens-plot", "Input and output tokens are tracked in this tokens plot."),
                        step(".tutorial-throughput-plot", "Endpoint throughput data can be viewed in this plot to compare the speed of various endpoints."),
                        step(".tutorial-latency-plot", "Conversely, endpoint latency data can be viewed in this plot to compare the latency of said endpoints."),
                        step(".tutorial-usage-filters", "All usage data can be filtered across such parameters as model name, provider or time."),
                        step("body", "You are now ready to view your API usage data. You can click on this button to go through the tour again."),
                    ],
    "/profile" :    [
                        step("body", "This tour will walk you through your profile page."),
                        step(".tutorial-user-information", "You can customize your information to personalize your account."),
                        step(".tutorial-newsletter-preferences", "You can choose the news you want to receive from us in your mailbox, if any."),
                        step("body", "You are now ready customize your user profile. You can click on this button to go through the tour again."),
                    ]
}

const TourSteps = (path: string) => {
    if (Object.keys(Steps).includes(path)) return Steps[path as keyof typeof Steps];
    return;
};

export default TourSteps;
