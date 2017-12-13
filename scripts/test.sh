#!/bin/bash

set -e

npm run build-css
npm run lint
npm run test-unit
