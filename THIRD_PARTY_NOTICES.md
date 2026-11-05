# Third-party notices

The adapter is generated from pi-acp 0.0.34 by Sergii Kozak. Its MIT license is reproduced below and retained in the installed dependency.

MIT License

Copyright (c) 2025 Sergii Kozak

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


T3 Code and Step Code are separate upstream projects. They are not bundled or redistributed.

The ACP TypeScript SDK 0.26.0 is licensed under Apache-2.0. Its original license remains at `node_modules/@agentclientprotocol/sdk/LICENSE`. The build creates a modified runtime copy at `.generated/acp-sdk/`, with the same license retained there. The modified `acp.js` omits diagnostic payloads; `stream.js` delegates to this project's bounded JSONL transport. These changes are local to the adapter and are not upstream SDK releases. Other bundled dependencies and the Node runtime retain their own licenses.

The Step logo asset is supplied for identification of Step Code. Brand assets are excluded from this project’s MIT code license. The Registry SVG is a monochrome vector rendering of the mark in https://avatars.githubusercontent.com/u/178004800?s=256&v=4, provided by the project owner. No ownership of the Step mark is claimed.
