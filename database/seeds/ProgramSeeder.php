<?php

use App\Program;
use App\Faculty;
use App\University;

class ProgramSeeder extends AbstractJsonFileSeeder
{
    protected $jsonFilesDirectory = 'seeds/data/programs';



    protected function processData($path, $data)
    {
        $fileNameParts  = explode('_', pathinfo($path, PATHINFO_FILENAME));
        $university     = University::where('slug', $fileNameParts[0])->firstOrFail();
        $faculty        = $university->faculties()->where('slug', $fileNameParts[1])->firstOrFail();

        $program = new Program;
        $program->faculty_id            = $faculty->id;
        $program->slug                  = $fileNameParts[2];
        $program->name                  = $data->name;
        $program->description           = $data->description;
        $program->curriculum_updated_at = $data->curriculum_updated_at;
        $program->save();
    }
}
