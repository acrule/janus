/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

define([
    'jquery',
    'base/js/namespace',
    '../janus/janus_history',
    '../janus/janus_source',
    '../janus/janus_indent',
    '../janus/janus_nb_history',
    '../janus/janus_history_viewer'
], function(
    $,
    Jupyter,
    JanusHistory,
    JanusSource,
    JanusIndent,
    JanusNBHist,
    JanusViewer
){

    function renderJanusMenu(){
        /* add Janus menu to main menubar */

        var navbar = $('#menubar .nav').first()

        navbar.append($('<li>')
            .addClass('dropdown')
            .attr('id', 'janus-header')
            .append($('<a>')
                .addClass('dropdown-toggle')
                .attr('href','#')
                .attr('data-toggle', 'dropdown')
                .text('Janus')
                )
            );

        var janusHeader = $('#janus-header')

        janusHeader.append($('<ul>')
            .addClass('dropdown-menu')
            .attr('id', 'janus-menu')
        );

        var janusMenu = $('#janus-menu');

        // indent cell
        janusMenu.append($('<li>')
            .attr('id', 'indent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Indent Cell')
                .click(JanusIndent.indentCell)
            )
        );

        // unindent cell
        janusMenu.append($('<li>')
            .attr('id', 'unindent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Unindent Cell')
                .click(JanusIndent.unindentCell)
            )
        );

        // toggle cell input
        janusMenu.append($('<li>')
            .attr('id', 'toggle_cell_input')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell Input Visibility')
                .click(JanusSource.toggleSourceVisibility)
            )
        );

        // toggle cell output
        janusMenu.append($('<li>')
            .attr('id', 'toggle_cell_output')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell Output Visibility')
                .click(JanusSource.toggleOutputVisibility)
            )
        );

        janusMenu.append($('<li>')
            .addClass('divider')
        );

        // toggle notebook history recording
        janusMenu.append($('<li>')
            .attr('id', 'toggle_nb_recording')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Notebook Recording')
                .click(JanusNBHist.toggleHistoryRecording)
            )
        );

        // toggle cell versions
        janusMenu.append($('<li>')
            .attr('id', 'toggle_cell_versions')
            .append($('<a>')
                .attr('href', '#')
                .text('Show Cell Versions')
                .click(JanusHistory.toggleCellVersions)
            )
        );

        // show notebook history
        janusMenu.append($('<li>')
            .attr('id', 'show_nb_history')
            .append($('<a>')
                .attr('href', '#')
                .text('Show Notebook History')
                .click(JanusViewer.createHistoryModal)
            )
        );
    }

    function renderJanusButtons() {
        /* add Janus buttons to toolbar for easy access */

        var indentAction = {
            icon: 'fa-indent',
            help    : 'Indent cells',
            help_index : 'zz',
            handler : JanusIndent.indentCell
        };

        var unindentAction = {
            icon: 'fa-outdent',
            help    : 'Unindent cells',
            help_index : 'zz',
            handler : JanusIndent.unindentCell
        };

        var toggleSourceAction = {
            icon: 'fa-code',
            help    : 'Toggle Input',
            help_index : 'zz',
            handler : JanusSource.toggleSourceVisibility
        };

        var toggleOutputAction = {
            icon: 'fa-area-chart',
            help    : 'Toggle Output',
            help_index : 'zz',
            handler : JanusSource.toggleOutputVisibility
        };

        var toggleNbHistAction = {
            icon: 'fa-history',
            help    : 'Toggle Notebook Recording',
            help_index : 'zz',
            handler : JanusNBHist.toggleHistoryRecording
        };

        var toggleHistoryAction = {
            icon: 'fa-code-fork',
            help    : 'Show Cell Versions',
            help_index : 'zz',
            handler : JanusHistory.toggleCellVersions
        };

        var prefix = 'janus';

        // generate full action names and link to action
        var full_toggle_action_name = Jupyter.actions.register(toggleSourceAction,
                                                            'toggle-cell-input',
                                                            prefix);
        var full_toggle_out_action_name = Jupyter.actions.register(toggleOutputAction,
                                                            'toggle-cell-output',
                                                            prefix);
        var full_indent_action_name = Jupyter.actions.register(indentAction,
                                                            'indent-cell',
                                                            prefix);
        var full_unindent_action_name = Jupyter.actions.register(unindentAction,
                                                            'unindent-cell',
                                                            prefix);
        var full_toggle_nb_hist_action_name = Jupyter.actions.register(toggleNbHistAction,
                                                            'toggle-nb-history',
                                                            prefix);
        var full_toggle_hist_action_name = Jupyter.actions.register(toggleHistoryAction,
                                                            'toggle-cell-history',
                                                            prefix);

        // add button groups to the main toolbar
        Jupyter.toolbar.add_buttons_group([full_indent_action_name,
                                        full_unindent_action_name,
                                        full_toggle_action_name,
                                        full_toggle_out_action_name]);

        Jupyter.toolbar.add_buttons_group([full_toggle_nb_hist_action_name,
                                        full_toggle_hist_action_name]);

        // add text link to view notebook history
        var history_label = $('<div id="history-label"/>')
        history_label.append($('<a>View Notebook History</a>')
                                .click(JanusViewer.createHistoryModal))
        Jupyter.toolbar.element.append(history_label)
    }

    function renderJanusUI(){
        /* Render both menu items and toolbar buttons */

        renderJanusMenu();
        renderJanusButtons();
    }

    return {
        renderJanusUI: renderJanusUI
    };
});
