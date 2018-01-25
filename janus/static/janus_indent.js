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

    function indentCell() {
        /* move selected cells to the sidebar */

        // find where the selected cells are in the notebook
        var cells = Jupyter.notebook.get_selected_cells();
        var nb_cells = Jupyter.notebook.get_cells();
        var sel_start_id = nb_cells.indexOf(cells[0]);
        var sel_end_id = nb_cells.indexOf(cells[cells.length - 1]);
        var start_id = nb_cells.indexOf(cells[0]);
        var end_id = nb_cells.indexOf(cells[cells.length - 1]);

        // check if cells prior to selection are already hidden
        while ( start_id > 0 ) {
            if ( nb_cells[start_id - 1].metadata.janus.cell_hidden == true ) {
                start_id = start_id -1;
            } else{
                break;
            }
        }

        // check if cells after the selection are already hidden
        while ( end_id < nb_cells.length - 1 ) {
            if ( nb_cells[end_id + 1].metadata.janus.cell_hidden == true ) {
                end_id = end_id + 1;
            } else{
                break;
            }
        }

        // get rid of the existing placeholders in our selection
        var start_element = nb_cells[start_id].element;
        var end_element = $(nb_cells[end_id].element).next();
        var contained_placeholders = $(start_element)
                                    .nextUntil(end_element)
                                    .add(end_element)
                                    .filter('div.indent-container');
        $(contained_placeholders).remove();

        // get the whole expanded selection of hidden cells_to_copy
        var hidden_cells = nb_cells.slice(start_id, end_id+1);
        var cell_ids = [];

        // set the metadata and hide cells
        for ( i=0; i < hidden_cells.length; i++ ) {
            hidden_cells[i].metadata.janus.cell_hidden = true;
            hidden_cells[i].element.addClass('hidden');
            cell_ids.push(hidden_cells[i].metadata.janus.cell_id);
        }

        // keep track of currently indented cells for future comparison
        Jupyter.sidebar.saveMarkerMetadata();

        // update the sidebar and placholders across the notebook
        Jupyter.sidebar.hideIndentedCells();
        Jupyter.sidebar.update();
    }

    function unindentCell() {
        /* move selected cells back to main notebook */

        // keep track of currently indented cells for future comparison
        Jupyter.sidebar.saveMarkerMetadata();

        // make hidden cells visible
        var cells = Jupyter.notebook.get_selected_cells();
        for ( i=0; i<cells.length; i++ ) {
            cells[i].element.removeClass('hidden');
            cells[i].metadata.janus.cell_hidden = false;
            cells[i].set_text(cells[i].sb_cell.get_text());
            cells[i].render();
        }

        // remove any hidden cells from the sidebar
        for ( j=0; j<Jupyter.sidebar.cells.length; j++ ) {
            if ( Jupyter.sidebar.cells[j].selected ) {
                Jupyter.sidebar.cells[j].element.addClass('hidden');
                Jupyter.sidebar.cells[j].element.remove();
                Jupyter.sidebar.cells.splice(j, 1);
            }
        }

        // update sidebar and notebook rendering of hidden cells
        Jupyter.sidebar.hideIndentedCells();
        Jupyter.sidebar.update();
    }

    return {
        indentCell: indentCell,
        unindentCell: unindentCell
    };
});
