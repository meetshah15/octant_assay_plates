var express = require('express');
var router = express.Router();
const { body, validationResult } = require('express-validator');

const mongoose = require('mongoose');
const db = mongoose.connection;
const Schema = mongoose.Schema;

const CounterSchema = Schema({
    _id: String,
    seq: Number,
  }, {collection: 'counters'});
const counterModel = mongoose.model('counters', CounterSchema);

const platesSchema = new Schema({ 
  _id: Number, 
  name: String, 
  size: Number, 
  plate: [{
      well_location: String,
      cell_line: String, 
      chemical: String, 
      concentration: String
    }],
}, {collection: 'plates'});
const platesModel = mongoose.model('plates', platesSchema );


/** 
 * API to fetch specific plates
*/
router.get('/:id', function(req, res){
    const plateData = platesModel.where({_id: req.params.id});
    plateData.findOne((err, result) => {
        if (err) return handleError(err);
        if (result) {
            res.json(result);
        } else {
            res.status(404).json({message: "No plates found"})
        }
    }
)}
);



/**
 * API to insert new plates in Database
 */
router.post('/',
    body('name').not().isEmpty(),
    body('size').not().isEmpty().isInt().toInt().isIn([384, 96]),
    function(req, res, next) {
        const body = req.body;
        // check if there are any missing input fields
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(errors);
        }

        db.collection("counters").findOneAndUpdate({
            _id: 'plates_id'
        }, {
            $inc: {
                seq: 1
            }
        }, {
            new: true
        }, (err, result) => {
            if (err) return res.json(err);

            db.collection("counters").find({
                    _id: "plates_id"
            }).toArray(function (err, result) {
                if (err) {
                    throw err;
                } else {
                    const new_index = result[0].seq;
                    const data = new platesModel(
                        { _id: new_index, 
                        name: body.name, 
                        size: body.size 
                        }
                    );
                    data.save((err) => { 
                        if (err) return res.json(err);
                        else res.json({id: data._id, name: body.name, size: data.size});
                    });
                }
            });
        });
    }
);

/**
 * API to insert well data in a plate
 */
router.post('/:id/wells', 
    body('row').not().isEmpty().isInt().toInt().isInt({max: 24}),
    body('col').not().isEmpty().isInt().toInt().isInt({max: 16}),
    body('cell_line').not().isEmpty().isString(),
    body('chemical').not().isEmpty().isString(),
    body('concentration').not().isEmpty().isString(),
    function(req, res) {

        const body = req.body;
        
        // check for missing/invalid inputs
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json(errors);
        }

        if (body.cell_line[0] !== 'c') {
            return res.status(422).json({"message": "Invalid cell_line value"})
        }

        const plateData = platesModel.where({_id: req.params.id});
        plateData.findOne((err, result) => {
            if (err) return handleError(err);
            if (result) {

                /**
                 * Checking for valid row, col values for a well
                 */
                if ((result.size === 384 && body.row >= 24) || (result.size === 96 && body.row >= 12)) {
                    return res.status(422).json({"message": "Invalid row value"})
                }

                if ((result.size === 384 && body.col >= 16) || (result.size === 96 && body.col >= 8)) {
                    return res.status(422).json({"message": "Invalid col value"})
                }

                const existing_well = result.plate;
                well = {
                    well_location: body.row + ":" + body.col,
                    cell_line: body.cell_line,
                    chemical: body.chemical,
                    concentration: body.concentration
                }

                const index = existing_well.findIndex(w => w.well_location === well.well_location);
                let message = 'Well updated successfully';
                if (index !== -1) {
                    existing_well[index] = well;
                    message = 'Found existing well. Updated its contents';
                } else {
                    existing_well.push(well);
                }
                result.plate = existing_well;
                result.save((err) => { 
                    if (err) res.json(err); 
                    res.json({"message": message})
                });
            } else {
                res.status(404).json({message: "No plates found"})
            }
        }
    )}
);

module.exports = router;