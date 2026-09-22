import express, { type Express } from 'express';

export type AppDependencies = Record<string, never>;

export function createApp(_dependencies: AppDependencies): Express {
  return express().use(express.json());
}
