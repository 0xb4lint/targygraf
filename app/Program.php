<?php

namespace App;

use Illuminate\Database\Eloquent\SoftDeletes;

class Program extends Model
{
    use SoftDeletes;

    protected $table = 'programs';



    public function courseBlocks()
    {
        return $this->hasMany(CourseBlock::class);
    }
}
