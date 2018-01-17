/*
Janus: Jupyter Notebook Extension that assists with notebook cleaning
Handle indenting and unindenting of cells to and from the Janus sidebar
*/

define([
    'jquery',
    'base/js/namespace',
    '../janus/janus_sidebar'
], function(
    $,
    Jupyter,
    JanusSidebar
){

    function indentCell(){
        /* move selected cells to the sidebar */
        cells = Jupyter.notebook.get_selected_cells();

        // find where the selected cells are in the notebook
        all_cells = Jupyter.notebook.get_cells();
        sel_start_id = all_cells.indexOf(cells[0]);
        sel_end_id = all_cells.indexOf(cells[cells.length - 1]);
        start_id = all_cells.indexOf(cells[0]);
        end_id = all_cells.indexOf(cells[cells.length - 1]);

        // check if the immediately prior cell(s) is/are already hidden
        while(start_id > 0){
            if(all_cells[start_id - 1].metadata.janus.cell_hidden == true){
                start_id = start_id -1;
            }
            else{
                break;
            }
        }

        // check if the immediately following cell(s) is/are already hidden
        while(end_id < all_cells.length - 1){
            if(all_cells[end_id + 1].metadata.janus.cell_hidden == true){
                end_id = end_id + 1;
            }
            else{
                break;
            }
        }

        // get rid of the existing placeholders
        start_element = all_cells[start_id].element;
        end_element = $(all_cells[end_id].element).next();
        contained_placeholders = $(start_element).nextUntil(end_element)
                                    .add(end_element)
                                    .filter('div.indent-container');
        $(contained_placeholders).remove();

        // get the whole expanded selection of hidden cells_to_copy
        hidden_cells = all_cells.slice(start_id, end_id+1);
        cell_ids = [];

        // set the metadata and hide cells
        for(i=0; i < hidden_cells.length; i++){
            hidden_cells[i].metadata.janus.cell_hidden = true;
            hidden_cells[i].element.addClass('hidden');
            cell_ids.push(hidden_cells[i].metadata.janus.cell_id);
        }

        // put placeholder div immediatley after last hidden cell
        Jupyter.sidebar.hideIndentedCells()
        // Jupyter.sidebar.addPlaceholderAfterElementWithIds(
        //     hidden_cells[hidden_cells.length - 1].element,
        //     cell_ids)
        Jupyter.sidebar.update();
        JanusSidebar.saveMarkerMetadata();
    }

    function unindentCell(){
        JanusSidebar.saveMarkerMetadata()
        /* move selected cells back to main notebook */
        cells = Jupyter.notebook.get_selected_cells();

        // make hidden cells visible
        for(i=0; i<cells.length; i++){
            cells[i].element.removeClass('hidden');
            cells[i].metadata.janus.cell_hidden = false;
            cells[i].set_text(cells[i].sb_cell.get_text());
            cells[i].render();
        }

        // remove any hidden cells from the sidebar
        for(j=0; j<Jupyter.sidebar.cells.length; j++){
            if(Jupyter.sidebar.cells[j].selected){
                Jupyter.sidebar.cells[j].element.addClass('hidden');
                Jupyter.sidebar.cells[j].element.remove();
                Jupyter.sidebar.cells.splice(i, 1);
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
