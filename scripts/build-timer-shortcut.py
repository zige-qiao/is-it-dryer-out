"""Generate the Shortcut source; macOS shortcuts sign produces the installer."""
import argparse
import plistlib
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5


def identifier(name):
    return str(uuid5(NAMESPACE_URL, 'is-it-dryer-out/timer/' + name)).upper()


def attachment(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def output(name):
    return attachment({'Type': 'ActionOutput', 'OutputUUID': identifier(name), 'OutputName': name})


def action(name, parameters=None, output_name=None):
    parameters = dict(parameters or {})
    if output_name:
        parameters['UUID'] = identifier(output_name)
    return {'WFWorkflowActionIdentifier': 'is.workflow.actions.' + name,
            'WFWorkflowActionParameters': parameters}


def build_shortcut():
    source = attachment({'Type': 'ExtensionInput'})
    group = identifier('validation')
    actions = [
        action('text.match', {
            'WFInput': source,
            'WFMatchTextPattern': r'\A(?:[1-9]|[1-9][0-9]|1[0-7][0-9]|180)\z',
            'WFMatchTextCaseSensitive': True,
        }, 'Matches'),
        action('count', {'WFInput': output('Matches'), 'WFCountType': 'Items'}, 'Count'),
        action('conditional', {
            'WFInput': output('Count'), 'WFCondition': 1, 'WFNumberValue': 1,
            'WFControlFlowMode': 0, 'GroupingIdentifier': group,
        }),
        action('alert', {
            'WFAlertActionTitle': 'Ventilation Timer',
            'WFAlertActionMessage': 'Enter 1-180 whole minutes.',
            'WFAlertActionCancelButtonShown': False,
        }),
        action('exit'),
        action('conditional', {'WFControlFlowMode': 2, 'GroupingIdentifier': group}),
        action('number', {'WFNumberActionNumber': source}, 'Minutes'),
        action('timer.start', {
            'WFDuration': {
                'Value': {'Magnitude': output('Minutes'), 'Unit': 'min'},
                'WFSerializationType': 'WFQuantityFieldValue',
            },
        }),
    ]
    return {
        'WFWorkflowName': 'Ventilation Timer',
        'WFWorkflowActions': actions,
        'WFWorkflowClientVersion': '3036.0.4',
        'WFWorkflowMinimumClientVersion': 900,
        'WFWorkflowMinimumClientVersionString': '900',
        'WFWorkflowHasShortcutInputVariables': True,
        'WFWorkflowInputContentItemClasses': ['WFStringContentItem'],
        'WFWorkflowTypes': [],
        'WFWorkflowImportQuestions': [],
        'WFQuickActionSurfaces': [],
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(plistlib.dumps(build_shortcut(), fmt=plistlib.FMT_XML))
