import { ChartLine, Eye, Table } from "lucide-react";
import barDemo from "@/constants/examples/bar-demo.json";
import contextDemo from "@/constants/examples/context-demo.json";
import derivedColumnsDemo from "@/constants/examples/derived-columns-demo.json";
import diffsDemo from "@/constants/examples/diffs-demo.json";
import filteringDemo from "@/constants/examples/filtering-demo.json";
import groupingDemo from "@/constants/examples/grouping-demo.json";
import hiddenColumnsDemo from "@/constants/examples/hidden-columns-demo.json";
import histogramDemo from "@/constants/examples/histogram-demo.json";
import lineDemo from "@/constants/examples/line-demo.json";
import lineDemo2 from "@/constants/examples/line-demo2.json";
import lineDemo3 from "@/constants/examples/line-demo3.json";
import markingAssistantDemo from "@/constants/examples/MarkingAssistant.json";
import scatterDemo from "@/constants/examples/scatter-demo.json";
import scatterDemo2 from "@/constants/examples/scatter-demo2.json";
import scatterDemo3 from "@/constants/examples/scatter-demo3.json";
import viewPaneDemo from "@/constants/examples/view-pane-demo.json";
import { TileProps } from "@/types/evals/grid";

export const metrics = ["mean", "count", "sum", "var", "std", "min", "max", "median", "mode"];

export const defaultItems = [
    {
        "i": "Table",
        "x": 0.0,
        "y": 0.0,
        "w": 7.0,
        "h": 8.0,
        "minW": undefined,
        "minH": undefined,
        "tab": "Table",
        "table_type": "Data Table"
    },
    {
        "i": "View",
        "x": 7.0,
        "y": 0.0,
        "w": 5.0,
        "h": 8.0,
        "minW": undefined,
        "minH": undefined,
        "tab": "View",
        "table": "Table"
    }
];

export const defaultNewCounter = 2;

export const defaultLogs = {
    "params": Array(10).fill({
        "experiment": 0
    }),
    "entries": [
        {
            "trace": {
                "id": "d05da0f2-dde7-4518-9b97-6cf32d628f1f",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 6.19192487500186,
                "timestamp": "2025-02-20T13:34:35.962797+00:00",
                "offset": 0.0,
                "cost": 0.0009603000000000001,
                "cost_inc_cache": 0.0009603000000000001,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "37 + 75"
                },
                "child_spans": [
                    {
                        "id": "ecc86a17-30b9-42ad-b3dd-15f04b66ecf3",
                        "type": "llm",
                        "parent_span_id": "d05da0f2-dde7-4518-9b97-6cf32d628f1f",
                        "span_name": "o3-mini@openai",
                        "exec_time": 3.255844209001225,
                        "timestamp": "2025-02-20T13:34:35.963532+00:00",
                        "offset": 0.0,
                        "cost": 0.0009603000000000001,
                        "cost_inc_cache": 0.0009603000000000001,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "37 + 75"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30zE9uL4rzcNLBdVhGe7hdelMrm9",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "To solve 37 + 75, you can break it down like this:\n1. Add the tens: 30 + 70 = 100\n2. Add the ones: 7 + 5 = 12\n3. Combine the two results: 100 + 12 = 112\n\nThus, 37 + 75 equals 112.",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058476,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 211,
                                "prompt_tokens": 29,
                                "total_tokens": 240,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 128,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0009603000000000001
                            }
                        }
                    },
                    {
                        "id": "e5f80e03-a91e-4af1-8713-1799432f8022",
                        "type": "function",
                        "parent_span_id": "d05da0f2-dde7-4518-9b97-6cf32d628f1f",
                        "span_name": "evaluate_response",
                        "exec_time": 0.000582125001528766,
                        "timestamp": "2025-02-20T13:34:40.023699+00:00",
                        "offset": 4.06,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "37 + 75",
                            "response": "To solve 37 + 75, you can break it down like this:\n1. Add the tens: 30 + 70 = 100\n2. Add the ones: 7 + 5 = 12\n3. Combine the two results: 100 + 12 = 112\n\nThus, 37 + 75 equals 112."
                        },
                        "outputs": 1.0
                    }
                ]
            },
            "question": "37 + 75",
            "response": "To solve 37 + 75, you can break it down like this:\n1. Add the tens: 30 + 70 = 100\n2. Add the ones: 7 + 5 = 12\n3. Combine the two results: 100 + 12 = 112\n\nThus, 37 + 75 equals 112.",
            "score": 1.0
        },
        {
            "trace": {
                "id": "5155745e-5836-4298-92d0-bc04aa0cdf27",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 7.303487583001697,
                "timestamp": "2025-02-20T13:34:35.337876+00:00",
                "offset": 0.0,
                "cost": 0.0008899000000000001,
                "cost_inc_cache": 0.0008899000000000001,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "43 - 45"
                },
                "child_spans": [
                    {
                        "id": "2d5310dd-86f4-40c3-aa4d-fdf762c560a8",
                        "type": "llm",
                        "parent_span_id": "5155745e-5836-4298-92d0-bc04aa0cdf27",
                        "span_name": "o3-mini@openai",
                        "exec_time": 3.3215256670009694,
                        "timestamp": "2025-02-20T13:34:35.338552+00:00",
                        "offset": 0.0,
                        "cost": 0.0008899000000000001,
                        "cost_inc_cache": 0.0008899000000000001,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "43 - 45"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30zDsLBZRqi5VukVYHrJNMaUhRqi",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "To solve 43 - 45, notice that subtracting a larger number from a smaller one results in a negative number. You can think of it as:\n\n\u2003\u200343 - 45 = -(45 - 43) = -2\n\nSo, the answer is -2.",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058475,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 195,
                                "prompt_tokens": 29,
                                "total_tokens": 224,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 128,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0008899000000000001
                            }
                        }
                    },
                    {
                        "id": "ae8e4101-73b2-493c-ac23-9af4206b1cbe",
                        "type": "function",
                        "parent_span_id": "5155745e-5836-4298-92d0-bc04aa0cdf27",
                        "span_name": "evaluate_response",
                        "exec_time": 0.00026233400058117695,
                        "timestamp": "2025-02-20T13:34:40.483372+00:00",
                        "offset": 5.15,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "43 - 45",
                            "response": "To solve 43 - 45, notice that subtracting a larger number from a smaller one results in a negative number. You can think of it as:\n\n\u2003\u200343 - 45 = -(45 - 43) = -2\n\nSo, the answer is -2."
                        },
                        "outputs": 0.0
                    }
                ]
            },
            "question": "43 - 45",
            "response": "To solve 43 - 45, notice that subtracting a larger number from a smaller one results in a negative number. You can think of it as:\n\n\u2003\u200343 - 45 = -(45 - 43) = -2\n\nSo, the answer is -2.",
            "score": 0.0
        },
        {
            "trace": {
                "id": "b18f8af5-f522-4b59-854c-5a3bb8727c38",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 9.70458625000174,
                "timestamp": "2025-02-20T13:34:33.267571+00:00",
                "offset": 0.0,
                "cost": 0.0015895000000000002,
                "cost_inc_cache": 0.0015895000000000002,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "89 - 16"
                },
                "child_spans": [
                    {
                        "id": "fd393f70-5fae-408d-a796-72ce9b13a570",
                        "type": "llm",
                        "parent_span_id": "b18f8af5-f522-4b59-854c-5a3bb8727c38",
                        "span_name": "o3-mini@openai",
                        "exec_time": 6.76175024999975,
                        "timestamp": "2025-02-20T13:34:33.267892+00:00",
                        "offset": 0.0,
                        "cost": 0.0015895000000000002,
                        "cost_inc_cache": 0.0015895000000000002,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "14 + 45"
                                },
                                {
                                    "role": "user",
                                    "content": "89 - 16"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30zCuSqXzvumR9dI9OJ0rgYzzgV6",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "14 + 45 equals 59.\n\nNow, for the subtraction:\n89 - 16 equals 73.",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058474,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 352,
                                "prompt_tokens": 37,
                                "total_tokens": 389,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 320,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0015895000000000002
                            }
                        }
                    },
                    {
                        "id": "473c4585-c775-4992-beb8-07e9e5271ace",
                        "type": "function",
                        "parent_span_id": "b18f8af5-f522-4b59-854c-5a3bb8727c38",
                        "span_name": "evaluate_response",
                        "exec_time": 0.0002943340005003847,
                        "timestamp": "2025-02-20T13:34:40.791883+00:00",
                        "offset": 7.52,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "89 - 16",
                            "response": "14 + 45 equals 59.\n\nNow, for the subtraction:\n89 - 16 equals 73."
                        },
                        "outputs": 1.0
                    }
                ]
            },
            "question": "89 - 16",
            "response": "14 + 45 equals 59.\n\nNow, for the subtraction:\n89 - 16 equals 73.",
            "score": 1.0
        },
        {
            "trace": {
                "id": "5f1a7ab5-4e11-4187-a717-1fe388dad9f0",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 8.003156458999001,
                "timestamp": "2025-02-20T13:34:32.785987+00:00",
                "offset": 0.0,
                "cost": 0.0007843,
                "cost_inc_cache": 0.0007843,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "14 + 45"
                },
                "child_spans": [
                    {
                        "id": "42621fe9-a25e-40ad-8c4f-885ae7e94f57",
                        "type": "llm",
                        "parent_span_id": "5f1a7ab5-4e11-4187-a717-1fe388dad9f0",
                        "span_name": "o3-mini@openai",
                        "exec_time": 4.028561541999807,
                        "timestamp": "2025-02-20T13:34:32.786213+00:00",
                        "offset": 0.0,
                        "cost": 0.0007843,
                        "cost_inc_cache": 0.0007843,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "14 + 45"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30zBdUIrqVOy5F1ca5pjsQSFqAdU",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "To add 14 and 45, simply add the two numbers together:\n\n\u2003\u200314 + 45 = 59\n\nSo, the answer is 59.",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058473,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 171,
                                "prompt_tokens": 29,
                                "total_tokens": 200,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 128,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0007843
                            }
                        }
                    },
                    {
                        "id": "0a5f1c04-102e-4109-962b-0020d34bbb1e",
                        "type": "function",
                        "parent_span_id": "5f1a7ab5-4e11-4187-a717-1fe388dad9f0",
                        "span_name": "evaluate_response",
                        "exec_time": 0.00040370900023845024,
                        "timestamp": "2025-02-20T13:34:38.651041+00:00",
                        "offset": 5.87,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "14 + 45",
                            "response": "To add 14 and 45, simply add the two numbers together:\n\n\u2003\u200314 + 45 = 59\n\nSo, the answer is 59."
                        },
                        "outputs": 1.0
                    }
                ]
            },
            "question": "14 + 45",
            "response": "To add 14 and 45, simply add the two numbers together:\n\n\u2003\u200314 + 45 = 59\n\nSo, the answer is 59.",
            "score": 1.0
        },
        {
            "trace": {
                "id": "7663b3c6-4144-4caf-b626-32a8dd6187ef",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 8.886959833998844,
                "timestamp": "2025-02-20T13:34:32.111165+00:00",
                "offset": 0.0,
                "cost": 0.0021703,
                "cost_inc_cache": 0.0021703,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "55 - 26"
                },
                "child_spans": [
                    {
                        "id": "e86db3af-c69e-433e-a806-4e124602a1b3",
                        "type": "llm",
                        "parent_span_id": "7663b3c6-4144-4caf-b626-32a8dd6187ef",
                        "span_name": "o3-mini@openai",
                        "exec_time": 5.845309457999974,
                        "timestamp": "2025-02-20T13:34:32.111597+00:00",
                        "offset": 0.0,
                        "cost": 0.0021703,
                        "cost_inc_cache": 0.0021703,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "82 - 91"
                                },
                                {
                                    "role": "user",
                                    "content": "58 - 54"
                                },
                                {
                                    "role": "user",
                                    "content": "98 - 74"
                                },
                                {
                                    "role": "user",
                                    "content": "27 - 45"
                                },
                                {
                                    "role": "user",
                                    "content": "22 + 67"
                                },
                                {
                                    "role": "user",
                                    "content": "55 - 26"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30zA6Gf1vCMZfW4nCI7hx3FwiwRY",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "Here are the calculations:\n\n1. 82 - 91 = -9  \n2. 58 - 54 = 4  \n3. 98 - 74 = 24  \n4. 27 - 45 = -18  \n5. 22 + 67 = 89  \n6. 55 - 26 = 29\n\nLet me know if you need further details or explanations!",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058472,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 476,
                                "prompt_tokens": 69,
                                "total_tokens": 545,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 384,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0021703
                            }
                        }
                    },
                    {
                        "id": "51420829-9d26-46b2-9faf-d772b1ec42d3",
                        "type": "function",
                        "parent_span_id": "7663b3c6-4144-4caf-b626-32a8dd6187ef",
                        "span_name": "evaluate_response",
                        "exec_time": 0.0003124169998045545,
                        "timestamp": "2025-02-20T13:34:38.692144+00:00",
                        "offset": 6.58,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "55 - 26",
                            "response": "Here are the calculations:\n\n1. 82 - 91 = -9  \n2. 58 - 54 = 4  \n3. 98 - 74 = 24  \n4. 27 - 45 = -18  \n5. 22 + 67 = 89  \n6. 55 - 26 = 29\n\nLet me know if you need further details or explanations!"
                        },
                        "outputs": 0.0
                    }
                ]
            },
            "question": "55 - 26",
            "response": "Here are the calculations:\n\n1. 82 - 91 = -9  \n2. 58 - 54 = 4  \n3. 98 - 74 = 24  \n4. 27 - 45 = -18  \n5. 22 + 67 = 89  \n6. 55 - 26 = 29\n\nLet me know if you need further details or explanations!",
            "score": 0.0
        },
        {
            "trace": {
                "id": "f49730a1-72fa-4357-98a5-c0f78867aa90",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 14.061876458999905,
                "timestamp": "2025-02-20T13:34:30.505312+00:00",
                "offset": 0.0,
                "cost": 0.0011275000000000002,
                "cost_inc_cache": 0.0011275000000000002,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "22 + 67"
                },
                "child_spans": [
                    {
                        "id": "1c7328e3-864e-4f46-9fab-f976f59ad212",
                        "type": "llm",
                        "parent_span_id": "f49730a1-72fa-4357-98a5-c0f78867aa90",
                        "span_name": "o3-mini@openai",
                        "exec_time": 9.519197249999706,
                        "timestamp": "2025-02-20T13:34:30.505843+00:00",
                        "offset": 0.0,
                        "cost": 0.0011275000000000002,
                        "cost_inc_cache": 0.0011275000000000002,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "82 - 91"
                                },
                                {
                                    "role": "user",
                                    "content": "58 - 54"
                                },
                                {
                                    "role": "user",
                                    "content": "98 - 74"
                                },
                                {
                                    "role": "user",
                                    "content": "27 - 45"
                                },
                                {
                                    "role": "user",
                                    "content": "22 + 67"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30zAo7d8o8gHWytNLu2T5nZb1lt4",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "82 - 91 = -9\n\n58 - 54 = 4\n\n98 - 74 = 24\n\n27 - 45 = -18\n\n22 + 67 = 89",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058472,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 241,
                                "prompt_tokens": 61,
                                "total_tokens": 302,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 192,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0011275000000000002
                            }
                        }
                    },
                    {
                        "id": "834fa711-3e33-4951-9428-950b828cab96",
                        "type": "function",
                        "parent_span_id": "f49730a1-72fa-4357-98a5-c0f78867aa90",
                        "span_name": "evaluate_response",
                        "exec_time": 0.0004053330012538936,
                        "timestamp": "2025-02-20T13:34:41.037833+00:00",
                        "offset": 10.53,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "22 + 67",
                            "response": "82 - 91 = -9\n\n58 - 54 = 4\n\n98 - 74 = 24\n\n27 - 45 = -18\n\n22 + 67 = 89"
                        },
                        "outputs": 1.0
                    }
                ]
            },
            "question": "22 + 67",
            "response": "82 - 91 = -9\n\n58 - 54 = 4\n\n98 - 74 = 24\n\n27 - 45 = -18\n\n22 + 67 = 89",
            "score": 1.0
        },
        {
            "trace": {
                "id": "aa983260-64f3-45e2-945c-f10330eb981a",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 7.4013780419991235,
                "timestamp": "2025-02-20T13:34:29.964160+00:00",
                "offset": 0.0,
                "cost": 0.0008547000000000001,
                "cost_inc_cache": 0.0008547000000000001,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "27 - 45"
                },
                "child_spans": [
                    {
                        "id": "f3a985a8-f33b-4267-adf9-30b1d1ca03aa",
                        "type": "llm",
                        "parent_span_id": "aa983260-64f3-45e2-945c-f10330eb981a",
                        "span_name": "o3-mini@openai",
                        "exec_time": 3.3112080420032726,
                        "timestamp": "2025-02-20T13:34:29.964889+00:00",
                        "offset": 0.0,
                        "cost": 0.0008547000000000001,
                        "cost_inc_cache": 0.0008547000000000001,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "82 - 91"
                                },
                                {
                                    "role": "user",
                                    "content": "58 - 54"
                                },
                                {
                                    "role": "user",
                                    "content": "98 - 74"
                                },
                                {
                                    "role": "user",
                                    "content": "27 - 45"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30z8TX2Ysb353zAgnE1XwXwthj7m",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "1. 82 - 91 = -9  \n2. 58 - 54 = 4  \n3. 98 - 74 = 24  \n4. 27 - 45 = -18",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058470,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 181,
                                "prompt_tokens": 53,
                                "total_tokens": 234,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 128,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0008547000000000001
                            }
                        }
                    },
                    {
                        "id": "9fe9d763-9801-4256-9154-4176510025c8",
                        "type": "function",
                        "parent_span_id": "aa983260-64f3-45e2-945c-f10330eb981a",
                        "span_name": "evaluate_response",
                        "exec_time": 0.000952750000578817,
                        "timestamp": "2025-02-20T13:34:34.150367+00:00",
                        "offset": 4.19,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "27 - 45",
                            "response": "1. 82 - 91 = -9  \n2. 58 - 54 = 4  \n3. 98 - 74 = 24  \n4. 27 - 45 = -18"
                        },
                        "outputs": 0.0
                    }
                ]
            },
            "question": "27 - 45",
            "response": "1. 82 - 91 = -9  \n2. 58 - 54 = 4  \n3. 98 - 74 = 24  \n4. 27 - 45 = -18",
            "score": 0.0
        },
        {
            "trace": {
                "id": "3cd6f1f1-cec7-43d6-8a19-9c05f5c7d367",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 7.673028124998382,
                "timestamp": "2025-02-20T13:34:29.483962+00:00",
                "offset": 0.0,
                "cost": 0.0015719000000000002,
                "cost_inc_cache": 0.0015719000000000002,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "98 - 74"
                },
                "child_spans": [
                    {
                        "id": "4a514ebc-9859-42ca-b749-7dadebbe3194",
                        "type": "llm",
                        "parent_span_id": "3cd6f1f1-cec7-43d6-8a19-9c05f5c7d367",
                        "span_name": "o3-mini@openai",
                        "exec_time": 4.794068999999581,
                        "timestamp": "2025-02-20T13:34:29.484432+00:00",
                        "offset": 0.0,
                        "cost": 0.0015719000000000002,
                        "cost_inc_cache": 0.0015719000000000002,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "82 - 91"
                                },
                                {
                                    "role": "user",
                                    "content": "58 - 54"
                                },
                                {
                                    "role": "user",
                                    "content": "98 - 74"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30z7SuwzDRGbnfyITT5hk3TNrxjm",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "Let's calculate each one step by step:\n\n1. 82 - 91  \n\u2003\u200382 is less than 91, so subtracting 91 from 82 gives a negative result.  \n\u2003\u200382 - 91 = -9  \n\n2. 58 - 54  \n\u2003\u2003Subtracting 54 from 58 gives:  \n\u2003\u200358 - 54 = 4  \n\n3. 98 - 74  \n\u2003\u2003Subtracting 74 from 98 gives:  \n\u2003\u200398 - 74 = 24  \n\nSo the results are:  \n\u2022 82 - 91 = -9  \n\u2022 58 - 54 = 4  \n\u2022 98 - 74 = 24",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058469,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 346,
                                "prompt_tokens": 45,
                                "total_tokens": 391,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 192,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0015719000000000002
                            }
                        }
                    },
                    {
                        "id": "f6a1d8e5-cd02-4258-aff5-fe361b894d4b",
                        "type": "function",
                        "parent_span_id": "3cd6f1f1-cec7-43d6-8a19-9c05f5c7d367",
                        "span_name": "evaluate_response",
                        "exec_time": 0.0008063330024015158,
                        "timestamp": "2025-02-20T13:34:34.964422+00:00",
                        "offset": 5.48,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "98 - 74",
                            "response": "Let's calculate each one step by step:\n\n1. 82 - 91  \n\u2003\u200382 is less than 91, so subtracting 91 from 82 gives a negative result.  \n\u2003\u200382 - 91 = -9  \n\n2. 58 - 54  \n\u2003\u2003Subtracting 54 from 58 gives:  \n\u2003\u200358 - 54 = 4  \n\n3. 98 - 74  \n\u2003\u2003Subtracting 74 from 98 gives:  \n\u2003\u200398 - 74 = 24  \n\nSo the results are:  \n\u2022 82 - 91 = -9  \n\u2022 58 - 54 = 4  \n\u2022 98 - 74 = 24"
                        },
                        "outputs": 1.0
                    }
                ]
            },
            "question": "98 - 74",
            "response": "Let's calculate each one step by step:\n\n1. 82 - 91  \n\u2003\u200382 is less than 91, so subtracting 91 from 82 gives a negative result.  \n\u2003\u200382 - 91 = -9  \n\n2. 58 - 54  \n\u2003\u2003Subtracting 54 from 58 gives:  \n\u2003\u200358 - 54 = 4  \n\n3. 98 - 74  \n\u2003\u2003Subtracting 74 from 98 gives:  \n\u2003\u200398 - 74 = 24  \n\nSo the results are:  \n\u2022 82 - 91 = -9  \n\u2022 58 - 54 = 4  \n\u2022 98 - 74 = 24",
            "score": 1.0
        },
        {
            "trace": {
                "id": "fa6c35b4-6770-43e2-a984-7922a696eb02",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 9.834199749999243,
                "timestamp": "2025-02-20T13:34:29.117960+00:00",
                "offset": 0.0,
                "cost": 0.0011539,
                "cost_inc_cache": 0.0011539,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "58 - 54"
                },
                "child_spans": [
                    {
                        "id": "0f716cc4-cea5-4042-8138-ddca8bb5958d",
                        "type": "llm",
                        "parent_span_id": "fa6c35b4-6770-43e2-a984-7922a696eb02",
                        "span_name": "o3-mini@openai",
                        "exec_time": 5.892321624996839,
                        "timestamp": "2025-02-20T13:34:29.118338+00:00",
                        "offset": 0.0,
                        "cost": 0.0011539,
                        "cost_inc_cache": 0.0011539,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "82 - 91"
                                },
                                {
                                    "role": "user",
                                    "content": "58 - 54"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30z8k9ej0561fWc3MVEPrVPPeAoB",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "For 82 - 91, since 91 is greater than 82, the result is negative. The calculation is:\n\n\u2003\u200382 - 91 = -9\n\nFor 58 - 54:\n\n\u2003\u200358 - 54 = 4",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058470,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 253,
                                "prompt_tokens": 37,
                                "total_tokens": 290,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 192,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0011539
                            }
                        }
                    },
                    {
                        "id": "1fae3691-09b2-42e3-ad72-a34e4e42aa17",
                        "type": "function",
                        "parent_span_id": "fa6c35b4-6770-43e2-a984-7922a696eb02",
                        "span_name": "evaluate_response",
                        "exec_time": 0.0007718749984633178,
                        "timestamp": "2025-02-20T13:34:35.752947+00:00",
                        "offset": 6.63,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "58 - 54",
                            "response": "For 82 - 91, since 91 is greater than 82, the result is negative. The calculation is:\n\n\u2003\u200382 - 91 = -9\n\nFor 58 - 54:\n\n\u2003\u200358 - 54 = 4"
                        },
                        "outputs": 1.0
                    }
                ]
            },
            "question": "58 - 54",
            "response": "For 82 - 91, since 91 is greater than 82, the result is negative. The calculation is:\n\n\u2003\u200382 - 91 = -9\n\nFor 58 - 54:\n\n\u2003\u200358 - 54 = 4",
            "score": 1.0
        },
        {
            "trace": {
                "id": "a02600c2-5979-418d-ad7a-8d8f413b55ed",
                "type": "function",
                "span_name": "evaluate",
                "exec_time": 7.889953041998524,
                "timestamp": "2025-02-20T13:34:27.634747+00:00",
                "offset": 0.0,
                "cost": 0.0001199,
                "cost_inc_cache": 0.0001199,
                "code": "```python\n@unify.traced\ndef evaluate(q: str):\n    response = client.generate(q)\n    score = evaluate_response(q, response)\n    unify.log(\n        question=q,\n        response=response,\n        score=score\n    )\n\n```",
                "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                "code_start_line": 207,
                "inputs": {
                    "q": "82 - 91"
                },
                "child_spans": [
                    {
                        "id": "a27b172a-a9e4-4f73-a1c9-b6c500beb859",
                        "type": "llm",
                        "parent_span_id": "a02600c2-5979-418d-ad7a-8d8f413b55ed",
                        "span_name": "o3-mini@openai",
                        "exec_time": 3.7925911669990455,
                        "timestamp": "2025-02-20T13:34:27.636816+00:00",
                        "offset": 0.0,
                        "cost": 0.0001199,
                        "cost_inc_cache": 0.0001199,
                        "code": "```python\n    @required_args([\"messages\", \"model\"], [\"messages\", \"model\", \"stream\"])\n    def create(\n        self,\n        *,\n        messages: Iterable[ChatCompletionMessageParam],\n        model: Union[str, ChatModel],\n        audio: Optional[ChatCompletionAudioParam] | NotGiven = NOT_GIVEN,\n        frequency_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        function_call: completion_create_params.FunctionCall | NotGiven = NOT_GIVEN,\n        functions: Iterable[completion_create_params.Function] | NotGiven = NOT_GIVEN,\n        logit_bias: Optional[Dict[str, int]] | NotGiven = NOT_GIVEN,\n        logprobs: Optional[bool] | NotGiven = NOT_GIVEN,\n        max_completion_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        max_tokens: Optional[int] | NotGiven = NOT_GIVEN,\n        metadata: Optional[Metadata] | NotGiven = NOT_GIVEN,\n        modalities: Optional[List[ChatCompletionModality]] | NotGiven = NOT_GIVEN,\n        n: Optional[int] | NotGiven = NOT_GIVEN,\n        parallel_tool_calls: bool | NotGiven = NOT_GIVEN,\n        prediction: Optional[ChatCompletionPredictionContentParam] | NotGiven = NOT_GIVEN,\n        presence_penalty: Optional[float] | NotGiven = NOT_GIVEN,\n        reasoning_effort: Optional[ChatCompletionReasoningEffort] | NotGiven = NOT_GIVEN,\n        response_format: completion_create_params.ResponseFormat | NotGiven = NOT_GIVEN,\n        seed: Optional[int] | NotGiven = NOT_GIVEN,\n        service_tier: Optional[Literal[\"auto\", \"default\"]] | NotGiven = NOT_GIVEN,\n        stop: Union[Optional[str], List[str]] | NotGiven = NOT_GIVEN,\n        store: Optional[bool] | NotGiven = NOT_GIVEN,\n        stream: Optional[Literal[False]] | Literal[True] | NotGiven = NOT_GIVEN,\n        stream_options: Optional[ChatCompletionStreamOptionsParam] | NotGiven = NOT_GIVEN,\n        temperature: Optional[float] | NotGiven = NOT_GIVEN,\n        tool_choice: ChatCompletionToolChoiceOptionParam | NotGiven = NOT_GIVEN,\n        tools: Iterable[ChatCompletionToolParam] | NotGiven = NOT_GIVEN,\n        top_logprobs: Optional[int] | NotGiven = NOT_GIVEN,\n        top_p: Optional[float] | NotGiven = NOT_GIVEN,\n        user: str | NotGiven = NOT_GIVEN,\n        # Use the following arguments if you need to pass additional parameters to the API that aren't available via kwargs.\n        # The extra values given here take precedence over values defined on the client or passed to this method.\n        extra_headers: Headers | None = None,\n        extra_query: Query | None = None,\n        extra_body: Body | None = None,\n        timeout: float | httpx.Timeout | None | NotGiven = NOT_GIVEN,\n    ) -> ChatCompletion | Stream[ChatCompletionChunk]:\n        validate_response_format(response_format)\n        return self._post(\n            \"/chat/completions\",\n            body=maybe_transform(\n                {\n                    \"messages\": messages,\n                    \"model\": model,\n                    \"audio\": audio,\n                    \"frequency_penalty\": frequency_penalty,\n                    \"function_call\": function_call,\n                    \"functions\": functions,\n                    \"logit_bias\": logit_bias,\n                    \"logprobs\": logprobs,\n                    \"max_completion_tokens\": max_completion_tokens,\n                    \"max_tokens\": max_tokens,\n                    \"metadata\": metadata,\n                    \"modalities\": modalities,\n                    \"n\": n,\n                    \"parallel_tool_calls\": parallel_tool_calls,\n                    \"prediction\": prediction,\n                    \"presence_penalty\": presence_penalty,\n                    \"reasoning_effort\": reasoning_effort,\n                    \"response_format\": response_format,\n                    \"seed\": seed,\n                    \"service_tier\": service_tier,\n                    \"stop\": stop,\n                    \"store\": store,\n                    \"stream\": stream,\n                    \"stream_options\": stream_options,\n                    \"temperature\": temperature,\n                    \"tool_choice\": tool_choice,\n                    \"tools\": tools,\n                    \"top_logprobs\": top_logprobs,\n                    \"top_p\": top_p,\n                    \"user\": user,\n                },\n                completion_create_params.CompletionCreateParams,\n            ),\n            options=make_request_options(\n                extra_headers=extra_headers, extra_query=extra_query, extra_body=extra_body, timeout=timeout\n            ),\n            cast_to=ChatCompletion,\n            stream=stream or False,\n            stream_cls=Stream[ChatCompletionChunk],\n        )\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/venv/lib/python3.12/site-packages/openai/_utils/_utils.py",
                        "code_start_line": 837,
                        "inputs": {
                            "messages": [
                                {
                                    "role": "system",
                                    "content": "You are a helpful maths assistant, tasked with adding and subtracting integers."
                                },
                                {
                                    "role": "user",
                                    "content": "82 - 91"
                                }
                            ],
                            "model": "o3-mini@openai",
                            "stream": false,
                            "temperature": 1.0,
                            "extra_body": {
                                "signature": "python",
                                "use_custom_keys": false,
                                "drop_params": true,
                                "log_query_body": true,
                                "log_response_body": true
                            }
                        },
                        "outputs": {
                            "id": "chatcmpl-B30z7O10Wyt7LjRADf1vY2NZvn5ay",
                            "choices": [
                                {
                                    "finish_reason": "stop",
                                    "index": 0,
                                    "message": {
                                        "content": "82 - 91 equals -9.",
                                        "role": "assistant"
                                    }
                                }
                            ],
                            "created": 1740058469,
                            "model": "o3-mini@openai",
                            "object": "chat.completion",
                            "usage": {
                                "completion_tokens": 20,
                                "prompt_tokens": 29,
                                "total_tokens": 49,
                                "completion_tokens_details": {
                                    "accepted_prediction_tokens": 0,
                                    "audio_tokens": 0,
                                    "reasoning_tokens": 0,
                                    "rejected_prediction_tokens": 0
                                },
                                "prompt_tokens_details": {
                                    "audio_tokens": 0,
                                    "cached_tokens": 0
                                },
                                "cost": 0.0001199
                            }
                        }
                    },
                    {
                        "id": "55063c30-f928-4685-8584-facaa3a99599",
                        "type": "function",
                        "parent_span_id": "a02600c2-5979-418d-ad7a-8d8f413b55ed",
                        "span_name": "evaluate_response",
                        "exec_time": 0.0004367080000520218,
                        "timestamp": "2025-02-20T13:34:32.189080+00:00",
                        "offset": 4.55,
                        "cost": 0.0,
                        "cost_inc_cache": 0.0,
                        "code": "```python\n@unify.traced\ndef evaluate_response(question: str, response: str) -> float:\n    correct_answer = eval(question)\n    try:\n        response_int = int(\n            \"\".join([c for c in response.split(\" \")[-1] if c.isdigit()]),\n        )\n        return float(correct_answer == response_int)\n    except ValueError:\n        return 0.\n\n```",
                        "code_fpath": "/Users/vedpatwardhan/Documents/Unify/unify/sample.py",
                        "code_start_line": 195,
                        "inputs": {
                            "question": "82 - 91",
                            "response": "82 - 91 equals -9."
                        },
                        "outputs": 0.0
                    }
                ]
            },
            "question": "82 - 91",
            "response": "82 - 91 equals -9.",
            "score": 0.0
        }
    ]
}

export const icons = {
    "Table": <Table />,
    "View": <Eye />,
    "Plot": <ChartLine />
};

export const tabTypes = ["Table", "Plot", "View"];

export const examples: {
    [key: string]: {
        project: string,
        name: string,
        items: TileProps[],
        new_counter: number,
        logs: any,
        code: string,
        gif: string,
    }
} = {
    "Basics/Context": { ...contextDemo, gif: "table_nested_contexts_dark" },
    "Tables/Derived Columns": { ...derivedColumnsDemo, gif: "table_derived_column_dark" },
    "Tables/Filtering": { ...filteringDemo, gif: "table_filter_str_dark" },
    "Tables/Grouping": { ...groupingDemo, gif: "table_grouping_dark" },
    "Views/Diffs": { ...diffsDemo, gif: "string_diffs_dark" },
    "Views/Hidden Columns": { ...hiddenColumnsDemo, gif: "view_show_hide_dark" },
    "Views/View Pane": { ...viewPaneDemo, gif: "view_pair_table_dark" },
    "Plots/Bar Plot": { ...barDemo, gif: "plots_bar_chart_grouping_dark" },
    "Plots/Histogram": { ...histogramDemo, gif: "histogram_dark" },
    "Plots/Line Plot": { ...lineDemo, gif: "line_dark" },
    "Plots/Line Plot 2": { ...lineDemo2, gif: "line_group_dark" },
    "Plots/Line Plot 3": { ...lineDemo3, gif: "line_six_groups_dark" },
    "Plots/Scatter Plot": { ...scatterDemo, gif: "scatter_dark"},
    "Plots/Scatter Plot 2": { ...scatterDemo2, gif: "scatter_grouped_dark"},
    "Plots/Scatter Plot 3": { ...scatterDemo3, gif: "scatter_two_groups_dark" },
    "Demos/Marking Assistant": { ...markingAssistantDemo, gif: "demo_set_context_to_usage" } as {
        project: string,
        name: string,
        items: TileProps[],
        new_counter: number,
        logs: any,
        code: string,
        gif: string,
    },
}
