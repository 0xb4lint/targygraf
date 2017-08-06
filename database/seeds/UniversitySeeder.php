<?php

use App\University;

class UniversitySeeder extends AbstractJsonFileSeeder
{
    protected $jsonFilesDirectory = 'seeds/data/universities';



    protected function processData($path, $data)
    {
        $university = new University;
        $university->slug       = pathinfo($path, PATHINFO_FILENAME);
        $university->name       = $data->name;
        $university->row        = $data->row;
        $university->ordering   = $data->ordering;
        $university->has_logo   = (bool)@$data->has_logo;
        $university->save();
    }
}
