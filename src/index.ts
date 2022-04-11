/* eslint-disable no-console */
/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * This module is the bootstrap entrypoint. It establishes the top-level event
 * listeners and loads the user's code.
 */

"use strict";

import { HandlerFunction, isHandlerFunction } from "./Common/index.js";
import * as Errors from "./Errors/index.js";
import RuntimeClient from "./RuntimeClient/index.js";
import Runtime from "./Runtime/index.js";
import BeforeExitListener from "./Runtime/BeforeExitListener.js";
// import LogPatch from "./utils/LogPatch";
import * as UserFunction from "./utils/UserFunction.js";

// LogPatch.patchConsole();

export function run(appRoot: string, handler: string): void;
export function run(handler: HandlerFunction): void;

export async function run(
  appRootOrHandler: string | HandlerFunction,
  handler: string = ""
) {
  if (!process.env.AWS_LAMBDA_RUNTIME_API) {
    throw new Error("Missing Runtime API Server configuration.");
  }
  const client = new RuntimeClient(process.env.AWS_LAMBDA_RUNTIME_API);

  const errorCallbacks = {
    uncaughtException: (error: Error) => {
      client.postInitError(error, () => process.exit(129));
    },
    unhandledRejection: (error: Error) => {
      client.postInitError(error, () => process.exit(128));
    },
  };

  process.on("uncaughtException", (error) => {
    errorCallbacks.uncaughtException(error);
    process.exit(129);
  });

  process.on("unhandledRejection", (reason, promise) => {
    const error = new Errors.UnhandledPromiseRejection(
      reason?.toString(),
      promise
    );
    errorCallbacks.unhandledRejection(error);
  });

  BeforeExitListener.reset();
  process.on("beforeExit", BeforeExitListener.invoke);

  const handlerFunc = isHandlerFunction(appRootOrHandler)
    ? appRootOrHandler
    : ((await UserFunction.load(appRootOrHandler, handler)) as HandlerFunction);
  const runtime = new Runtime(client, handlerFunc, errorCallbacks);

  runtime.scheduleIteration();
}
