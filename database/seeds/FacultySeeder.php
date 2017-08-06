<?php

use App\Faculty;
use App\University;

class FacultySeeder extends AbstractJsonFileSeeder
{
    protected $jsonFilesDirectory = 'seeds/data/faculties';



    protected function processData($path, $data)
    {
        $fileNameParts = explode('_', pathinfo($path, PATHINFO_FILENAME));

        $faculty = new Faculty;
        $faculty->university_id = University::where('slug', $fileNameParts[0])->value('id');
        $faculty->slug          = $fileNameParts[1];
        $faculty->name          = $data->name;
        $faculty->ordering      = $data->ordering;
        $faculty->save();
    }
}
