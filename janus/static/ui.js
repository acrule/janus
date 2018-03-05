/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'jquery',
    'base/js/namespace',
    '../janus/comment',
    '../janus/versions',
    '../janus/hide',
    '../janus/history',
    '../janus/history_viewer',
    '../janus/comment'
], function(
    $,
    Jupyter,
    JanusComment,
    JanusVersions,
    JanusHide,
    JanusHistory,
    JanusViewer,
    JanusComment
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
                        'toggle_cell',
                        'Hide Cell',
                        JanusHide.toggleSelCellsVisibility);
        addItemToMenu(janusMenu,
                        'toggle_cell_input',
                        'Hide Cell Input',
                        JanusHide.toggleSourceVisibility);
        addItemToMenu(janusMenu,
                        'toggle_cell_output',
                        'Hide Cell Output',
                        JanusHide.toggleOutputVisibility);
        addItemToMenu(janusMenu,
                        'toggle_cell_versions',
                        'Show Cell Versions',
                        JanusVersions.toggleCellVersions);

        janusMenu.append( $('<li>').addClass('divider') );

        addItemToMenu(janusMenu,
                        'hide_hidden_cells',
                        'Toggle Sidebar',
                        JanusHide.toggleAllSections);

        janusMenu.append( $('<li>').addClass('divider') );

        addItemToMenu(janusMenu,
                        'toggle_nb_recording',
                        'Stop Tracking Changes',
                        JanusHistory.toggleHistoryRecording);
        addItemToMenu(janusMenu,
                        'show_nb_history',
                        'Show Notebook History',
                        JanusViewer.createHistoryModal);

        janusMenu.append( $('<li>').addClass('divider') );

        addItemToMenu(janusMenu,
            'export_db',
            'Export Cleaned DB',
            JanusComment.exportClean);

        addItemToMenu(janusMenu,
                        'leave_comment',
                        'Leave A Comment',
                        JanusComment.createCommentModal);

    }


    function renderJanusButtons() {
        /* add Janus buttons to toolbar for easy access */

        var toggleCellAction = {
            icon: 'fa-eye-slash',
            help    : 'Hide Cell',
            help_index : 'zz',
            handler : JanusHide.toggleSelCellsVisibility
        };

        var toggleSourceAction = {
            icon: 'fa-code',
            help    : 'Hide Input',
            help_index : 'zz',
            handler : JanusHide.toggleSourceVisibility
        };

        var toggleOutputAction = {
            icon: 'fa-area-chart',
            help    : 'Hide Output',
            help_index : 'zz',
            handler : JanusHide.toggleOutputVisibility
        };

        var toggleCellVerAction = {
            icon: 'fa-history',
            help    : 'Show Cell Versions',
            help_index : 'zz',
            handler : JanusVersions.toggleCellVersions
        };

        var toggleSidebarAction = {
            icon: 'fa-columns',
            help    : 'Toggle Sidebar',
            help_index : 'zz',
            handler : JanusHide.toggleAllSections
        };

        var commentAction = {
            icon: 'fa-comment',
            help    : 'Leave Comment',
            help_index : 'zz',
            handler : JanusComment.createCommentModal
        }


        // generate full action names and link to action
        var prefix = 'janus';
        var actionHandler = Jupyter.actions

        var toggleCellName = actionHandler.register(toggleCellAction,
                                                        'toggle-cell',
                                                        prefix);
        var toggleSourceName = actionHandler.register(toggleSourceAction,
                                                        'toggle-cell-input',
                                                        prefix);
        var toggleOutputName = actionHandler.register(toggleOutputAction,
                                                        'toggle-cell-output',
                                                        prefix);
        var toggleCellVerName = actionHandler.register(toggleCellVerAction,
                                                        'toggle-cell-history',
                                                        prefix);
        var toggleSidebarName = actionHandler.register(toggleSidebarAction,
                                                        'show-all-hidden',
                                                        prefix);
        var commentName = actionHandler.register(commentAction,
                                                        'leave-comment',
                                                        prefix);

        // add button groups to the main toolbar
        Jupyter.toolbar.add_buttons_group([toggleCellName,
                                        toggleSourceName,
                                        toggleOutputName,
                                        toggleCellVerName]);

        Jupyter.toolbar.add_buttons_group([toggleSidebarName]);

        Jupyter.toolbar.add_buttons_group([commentName]);

        // add text link to view notebook history
        var history_label = $('<div id="history-label"/>')
        history_label.append($('<a>View Notebook History</a>')
                                .click(JanusViewer.createHistoryModal))
        Jupyter.toolbar.element.append(history_label)

        // start loop to check for history every 60 seconds
        JanusHistory.updateHistoryUI();
        setInterval(JanusHistory.updateHistoryUI, 60000)

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
