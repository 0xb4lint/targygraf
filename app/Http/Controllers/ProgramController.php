<?php

namespace App\Http\Controllers;

use App\Program;
use App\University;

class ProgramController extends Controller
{
    public function getProgram(University $university, Program $program)
    {
        $university->load('faculties.programs');

        $program->load([
            'courseBlocks.courses.prerequisites',
            'courseBlocks.courses.courseBlockReferences',
        ]);

        return view('layouts.program', [
            'university'    => $university,
            'program'       => $program,
        ]);
    }
}
