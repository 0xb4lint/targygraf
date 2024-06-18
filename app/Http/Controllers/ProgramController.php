<?php

namespace App\Http\Controllers;

use App\Program;
use App\University;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class ProgramController extends Controller
{
    public function getProgram(University $university, $programSlug)
    {
        $program = null;
        $university->load('faculties.programs');

        foreach ($university->faculties as $faculty) {
            foreach ($faculty->programs as $_program) {
                if ($_program->slug == $programSlug) {
                    $program = $_program;
                    break 2;
                }
            }
        }

        if (! $program) {
            throw (new ModelNotFoundException)->setModel(Program::class);
        }

        $program->load([
            'courseBlocks.courses.prerequisites',
            'courseBlocks.courses.courseBlockReferences',
        ]);

        return view('layouts.program', [
            'university' => $university,
            'program' => $program,
        ]);
    }
}
