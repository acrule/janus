/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
folding cells and keeping track of all changes

Handle indenting and unindenting of cells to and from the Janus sidebar
*/

define([
    'jquery',
    'base/js/namespace'
], function(
    $,
    Jupyter
){

    function getTimeAndSelection() {
        /* get time and selected cells */

        var t = Date.now();
        var selIndex = Jupyter.notebook.get_selected_index();
        var selIndices = Jupyter.notebook.get_selected_cells_indices();

        return {
            t: t,
            selIndex: selIndex,
            selIndices: selIndices
        }
    }


    return {
        getTimeAndSelection: getTimeAndSelection,
    }


})
