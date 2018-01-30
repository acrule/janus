/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes
*/

define([
    'jquery',
    'base/js/namespace',
    '../janus/versions',
    '../janus/fold',
    '../janus/history',
    '../janus/history_viewer'
], function(
    $,
    Jupyter,
    JanusVersions,
    JanusFold,
    JanusHistory,
    JanusViewer
){

    function addItemToMenu(menu, id, text, click) {
        /* add <li> to menu

        args:
            menu: menu item to append <li> to
            id: css id
            text: text to put on menuitem
            click: action to take on item click
        */

        menu.append($('<li>')
            .attr('id', id)
            .append($('<a>')
                .attr('href', '#')
                .text(text)
                .click(click)
            )
        );
    }


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

        var janusHeader = $('#janus-header');

        janusHeader.append($('<ul>')
            .addClass('dropdown-menu')
            .attr('id', 'janus-menu')
        );

        var janusMenu = $('#janus-menu');

        addItemToMenu(janusMenu,
                        'indent_cell',
                        'Toggle Cell',
                        JanusFold.toggleSelCellsVisibility);
        // addItemToMenu(janusMenu,
        //                 'unindent_cell',
        //                 'Unindent Cell',
        //                 JanusFold.unindentSelectedCells);
        addItemToMenu(janusMenu,
                        'toggle_cell_input',
                        'Show / Hide Cell Source',
                        JanusFold.toggleSourceVisibility);
        addItemToMenu(janusMenu,
                        'toggle_cell_output',
                        'Show / Hide Cell Output',
                        JanusFold.toggleOutputVisibility);

        janusMenu.append( $('<li>').addClass('divider') );

        addItemToMenu(janusMenu,
                        'toggle_nb_recording',
                        'Stop Tracking Changes',
                        JanusHistory.toggleHistoryRecording);
        addItemToMenu(janusMenu,
                        'toggle_cell_versions',
                        'Show / Cell Version',
                        JanusVersions.toggleCellVersions);
        addItemToMenu(janusMenu,
                        'show_nb_history',
                        'Show Notebook History',
                        JanusViewer.createHistoryModal);
    }


    function renderJanusButtons() {
        /* add Janus buttons to toolbar for easy access */

        var indentAction = {
            icon: 'fa-eye-slash',
            help    : 'Hide cells',
            help_index : 'zz',
            handler : JanusFold.toggleSelCellsVisibility
        };

        // var unindentAction = {
        //     icon: 'fa-outdent',
        //     help    : 'Show cells',
        //     help_index : 'zz',
        //     handler : JanusFold.unindentSelectedCells
        // };

        var toggleSourceAction = {
            icon: 'fa-code',
            help    : 'Toggle Input',
            help_index : 'zz',
            handler : JanusFold.toggleSourceVisibility
        };

        var toggleOutputAction = {
            icon: 'fa-area-chart',
            help    : 'Toggle Output',
            help_index : 'zz',
            handler : JanusFold.toggleOutputVisibility
        };

        // var toggleNBHistAction = {
        //     icon: 'fa-history',
        //     help    : 'Toggle Notebook Recording',
        //     help_index : 'zz',
        //     handler : JanusHistory.toggleHistoryRecording
        // };

        var toggleCellVerAction = {
            icon: 'fa-history',
            help    : 'Show Cell Versions',
            help_index : 'zz',
            handler : JanusVersions.toggleCellVersions
        };


        // generate full action names and link to action
        var prefix = 'janus';
        var actionHandler = Jupyter.actions

        var indentName = actionHandler.register(indentAction,
                                                        'indent-cell',
                                                        prefix);
        // var unindentName = actionHandler.register(unindentAction,
        //                                                 'unindent-cell',
        //                                                 prefix);
        var toggleSourceName = actionHandler.register(toggleSourceAction,
                                                        'toggle-cell-input',
                                                        prefix);
        var toggleOutputName = actionHandler.register(toggleOutputAction,
                                                        'toggle-cell-output',
                                                        prefix);
        // var toggleNBHistName = actionHandler.register(toggleNBHistAction,
        //                                                 'toggle-nb-history',
        //                                                 prefix);
        var toggleCellVerName = actionHandler.register(toggleCellVerAction,
                                                        'toggle-cell-history',
                                                        prefix);

        // add button groups to the main toolbar
        Jupyter.toolbar.add_buttons_group([indentName,
                                        toggleSourceName,
                                        toggleOutputName]);

        Jupyter.toolbar.add_buttons_group([toggleCellVerName]);

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
