"""Fail-closed, empty-toolset entry point for the site's isolated Athena turns."""
import os,sys
from pathlib import Path
root=Path(os.environ['LOCALAPPDATA'])/'hermes'
os.environ['HERMES_SAFE_MODE']='1'
os.environ['HERMES_IGNORE_USER_CONFIG']='1'
os.environ['HERMES_IGNORE_RULES']='1'
os.environ['HERMES_HOME']=str(root/'profiles/athena')
sys.path.insert(0,str(root/'hermes-agent'))
from toolsets import create_custom_toolset
create_custom_toolset('sieste_chat_no_tools','Isolated sieste analysis',tools=[])
from model_tools import get_tool_definitions
if get_tool_definitions(enabled_toolsets=['sieste_chat_no_tools'],quiet_mode=True):
    raise RuntimeError('Refusing to start: chat tools must be empty')
from hermes_cli.main import main
main()
