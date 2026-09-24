-- Headless Neovim against the installed pss-ls (plan 3.6).
--
-- nvim --headless --clean -l neovim-smoke.lua <pss-ls> <root> <file> <out>
--
-- Opens <file>, starts pss-ls with Neovim's built-in client, waits for
-- diagnostics, asks for the definition under line 3 column 5, and writes both
-- to <out> as JSON. The test does the asserting; this only reports.
local cmd, root, file, out = arg[1], arg[2], arg[3], arg[4]

local function finish(result)
  vim.fn.writefile({ vim.json.encode(result) }, out)
  -- Stops the client first, which sends shutdown and exit to the server.
  vim.cmd('qall!')
end

vim.cmd.edit(vim.fn.fnameescape(file))
vim.bo.filetype = 'pss'
local client_id = vim.lsp.start({ name = 'pss-ls', cmd = { cmd, '--stdio' }, root_dir = root })
if not client_id then
  finish({ error = 'vim.lsp.start returned nil' })
  return
end

local got = vim.wait(15000, function() return #vim.diagnostic.get(0) > 0 end, 50)
local diagnostics = {}
for _, d in ipairs(vim.diagnostic.get(0)) do
  table.insert(diagnostics, { lnum = d.lnum, col = d.col, message = d.message, source = d.source })
end

vim.api.nvim_win_set_cursor(0, { 3, 4 })
local params = vim.lsp.util.make_position_params(0, 'utf-16')
local responses = vim.lsp.buf_request_sync(0, 'textDocument/definition', params, 5000) or {}
local definitions = {}
for _, r in pairs(responses) do
  if r.result then
    local list = r.result.uri and { r.result } or r.result
    for _, loc in ipairs(list) do
      table.insert(definitions, { uri = loc.uri or loc.targetUri, line = (loc.range or loc.targetSelectionRange).start.line })
    end
  end
end

finish({ timedOut = not got, diagnostics = diagnostics, definitions = definitions })
