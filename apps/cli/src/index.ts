#!/usr/bin/env bun
import { Command } from "commander";
import { registerMonitorCommands } from "./commands/monitor.js";

const program = new Command();

program
  .name("argos")
  .description("ARGOS operator CLI — local-first OSINT toolkit")
  .version("0.1.0");

registerMonitorCommands(program);

program.parse();
