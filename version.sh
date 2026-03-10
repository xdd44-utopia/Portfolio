#!/bin/bash
# bump-version.sh
VERSION=$(date +%s)  # Uses current timestamp

find . -name "*.html" -exec sed -i "" "s/?v=[0-9]*/?v=$VERSION/g" {} +
echo "Updated all HTML files to ?v=$VERSION"