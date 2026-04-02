import { UNCLECODE_COMMAND_NAME } from "@unclecode/contracts";
import { Box, Newline, Text, render } from "ink";
import React from "react";

function WorkspaceShell() {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>{UNCLECODE_COMMAND_NAME}</Text>
      <Text>
        Task 1 scaffold complete. Runtime behavior will be added in later tasks.
      </Text>
      <Text color="gray">
        Use <Text bold>unclecode --help</Text> to inspect the new command
        surface.
      </Text>
      <Newline />
    </Box>
  );
}

export async function renderTui(): Promise<void> {
  const instance = render(<WorkspaceShell />);
  await instance.waitUntilExit();
}
