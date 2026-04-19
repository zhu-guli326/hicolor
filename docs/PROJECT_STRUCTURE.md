# Project Structure

## Overview

This project is a single-page visual editor for:

- uploading one main image
- building a split-layout composition with a color block area
- placing shapes and overlay text
- exporting PNG or video

The current implementation is feature-rich but concentrated heavily inside `src/App.tsx`, so both the UI structure and code structure can feel dense.

## Current Page Structure

The page is organized into four major areas:

1. Header
   Contains language switch, upload entry, and PNG export.

2. Main preview stage
   Shows the current composition preview and image canvas.

3. Bottom navigation
   Switches between `Background`, `Elements`, and `Video`.

4. Sliding settings panel
   Opens above the bottom navigation and renders the controls for the selected tab.

## Interaction Flow

Recommended user flow:

1. Upload image
2. Adjust layout and background
3. Add shapes / overlay text
4. Choose animation
5. Export PNG or video

This flow now appears in the UI as a workflow guide so the editor feels less overwhelming on first use.

## Main Code Areas

### `src/App.tsx`

This is the central file and currently contains:

- page layout
- canvas rendering
- animation preview logic
- export logic
- upload handlers
- panel rendering
- analytics UI
- interaction state

It is the main source of complexity because UI composition, rendering logic, and export logic all live together.

### `src/hooks/useStats.ts`

Tracks local usage metrics and export counts.

### `src/hooks/useAnalytics.ts`

Builds richer derived analytics such as funnel, hourly distribution, and weekly comparison.

### `src/i18n/*`

Handles locale selection and UI copy.

## Why The UI Feels Busy

The current UI density comes from a few structural causes:

- one large sliding settings panel contains many unrelated controls
- advanced controls appear close to basic controls
- the page previously lacked a clear “what should I do next” guide
- export, preview, editing, and analytics all coexist in one surface

## Changes Added In This Pass

To make the page easier to understand without rebuilding everything:

- added a visible workflow guide above the preview
- added panel-level descriptions for `Background`, `Elements`, and `Video`
- clarified the intended order of operations in the interface

These changes reduce cognitive load without breaking existing behavior.

## Refactor Roadmap

If we continue cleaning this project up, the next high-value steps are:

1. Split `App.tsx` into feature modules
   Suggested first targets:
   - `components/Header.tsx`
   - `components/WorkflowGuide.tsx`
   - `components/SettingsPanel.tsx`
   - `components/tabs/BackgroundTab.tsx`
   - `components/tabs/ElementsTab.tsx`
   - `components/tabs/VideoTab.tsx`

2. Extract canvas/export utilities
   Suggested targets:
   - `lib/layout.ts`
   - `lib/renderPreview.ts`
   - `lib/renderExportFrame.ts`
   - `lib/videoExport.ts`

3. Separate preview rendering from export rendering
   These share concepts, but should not depend on each other’s canvas snapshots.

4. Reduce panel density
   Split each tab into:
   - basic controls
   - advanced controls

5. Add a dedicated export quality mode
   For example:
   - Fast
   - Standard
   - High

## Suggested Mental Model For Contributors

When editing this project, think in this order:

1. Layout and composition
2. Preview rendering
3. Interaction state
4. Animation preview
5. Export rendering
6. Download / save behavior

That order matches how the user experiences the editor and makes bugs easier to reason about.
