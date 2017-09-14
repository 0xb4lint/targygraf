<?php

use App\Faculty;
use App\University;

class FacultySeeder extends AbstractJsonFileSeeder
{
    protected $jsonFilesDirectory = 'json/faculties';

    protected function processData($path, stdClass $data)
    {
        $this->command->comment($path);

        $fileNameParts = explode('_', pathinfo($path, PATHINFO_FILENAME));
        $university = University::where('slug', $fileNameParts[0])->firstOrFail();

        $faculty = new Faculty;
        $faculty->university_id = $university->id;
        $faculty->slug = $fileNameParts[1];
        $faculty->name = $data->name;
        $faculty->ordering = $data->ordering;
        $faculty->save();
    }
}
