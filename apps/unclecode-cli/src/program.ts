import {
  explainUncleCodeConfig,
  formatUncleCodeConfigExplanation,
} from "@unclecode/config-core";
import {
  MODE_PROFILE_IDS,
  UNCLECODE_COMMAND_NAME,
} from "@unclecode/contracts";
import type { ModeProfileId } from "@unclecode/contracts";
import {
  buildOpenAIAuthorizationUrl,
  completeOpenAIDeviceLogin,
  createOpenAIPkcePair,
  formatOpenAIAuthStatus,
  resolveOpenAIAuthStatus,
} from "@unclecode/providers";
import { renderTui } from "@unclecode/tui";
import { Command, Option } from "commander";
import os from "node:os";
import path from "node:path";

const UNCLECODE_CLI_VERSION = "0.1.0";

export function shouldLaunchDefaultTui(input: {
  args: readonly string[];
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}): boolean {
  return input.args.length === 0 && input.stdinIsTTY && input.stdoutIsTTY;
}

export function createUncleCodeProgram(): Command {
  const program = new Command();

  program
    .name(UNCLECODE_COMMAND_NAME)
    .description("UncleCode workspace shell")
    .version(UNCLECODE_CLI_VERSION)
    .showHelpAfterError();

  program.action(async () => {
    if (
      shouldLaunchDefaultTui({
        args: process.argv.slice(2),
        stdinIsTTY: process.stdin.isTTY ?? false,
        stdoutIsTTY: process.stdout.isTTY ?? false,
      })
    ) {
      await renderTui();
      return;
    }

    program.outputHelp();
  });

  program
    .command("tui")
    .description("Launch the Task 1 TUI boundary")
    .action(async () => {
      await renderTui();
    });

  const configCommand = program.command("config").description("Inspect effective UncleCode config");
  const authCommand = program.command("auth").description("Inspect and manage provider authentication");

  configCommand
    .command("explain")
    .description("Explain resolved settings, prompt sections, and active mode overlays")
    .addOption(
      new Option("--mode <mode>", "Override the active mode for this invocation").choices(
        MODE_PROFILE_IDS,
      ),
    )
    .option("--model <model>", "Override the configured model for this invocation")
    .action((options: { mode?: string; model?: string }) => {
      const cliFlags: {
        mode?: ModeProfileId;
        model?: string;
      } = {
        ...(isModeProfileId(options.mode) ? { mode: options.mode } : {}),
        ...(options.model ? { model: options.model } : {}),
      };

      const explanation = explainUncleCodeConfig({
        workspaceRoot: process.cwd(),
        env: process.env,
        cliFlags,
      });

      process.stdout.write(`${formatUncleCodeConfigExplanation(explanation)}\n`);
    });

  authCommand
    .command("login")
    .description("Start OpenAI OAuth login")
    .option("--browser", "Use browser-based login")
    .option("--device", "Use device-code login")
    .option("--print", "Print the login URL or device prompt instead of opening anything")
    .action(async (options: { browser?: boolean; device?: boolean; print?: boolean }) => {
      const clientId = process.env.OPENAI_OAUTH_CLIENT_ID?.trim();

      if (!clientId) {
        throw new Error("OPENAI_OAUTH_CLIENT_ID is required for OAuth login.");
      }

      const redirectUri =
        process.env.OPENAI_OAUTH_REDIRECT_URI?.trim() || "http://localhost:7777/callback";

      if (options.device) {
        const baseUrl = process.env.OPENAI_OAUTH_BASE_URL?.trim();
        const credentialsPath =
          process.env.UNCLECODE_OPENAI_CREDENTIALS_PATH?.trim() ||
          path.join(os.homedir(), ".unclecode", "credentials", "openai.json");

        process.stdout.write("Starting device login…\n");

        const result = await completeOpenAIDeviceLogin({
          clientId,
          scopes: ["openid", "profile", "offline_access"],
          credentialsPath,
          ...(baseUrl ? { baseUrl } : {}),
        });

        process.stdout.write(
          `Please visit ${result.verificationUri} and enter code: ${result.userCode}\n`,
        );
        process.stdout.write("Login successful.\n");
        return;
      }

      const pkce = createOpenAIPkcePair();
      const url = buildOpenAIAuthorizationUrl({
        clientId,
        redirectUri,
        state: pkce.state,
        codeChallenge: pkce.codeChallenge,
        scopes: ["openid", "profile", "offline_access"],
      });

      process.stdout.write(`${url.toString()}\n`);
    });

  authCommand
    .command("status")
    .description("Show OpenAI auth source, org/project context, and expiry state")
    .action(async () => {
      const status = await resolveOpenAIAuthStatus({ env: process.env });

      process.stdout.write(`${formatOpenAIAuthStatus(status)}\n`);
    });

  return program;
}

function isModeProfileId(value: string | undefined): value is ModeProfileId {
  return value !== undefined && MODE_PROFILE_IDS.includes(value as ModeProfileId);
}
